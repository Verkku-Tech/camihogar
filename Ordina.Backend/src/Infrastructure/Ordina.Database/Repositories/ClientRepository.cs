using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using Ordina.Database.Entities.Client;
using Ordina.Database.Helpers;
using Ordina.Database.MongoContext;

namespace Ordina.Database.Repositories;

public class ClientRepository : IClientRepository
{
    private readonly IMongoCollection<Client> _collection;

    public ClientRepository(MongoDbContext context)
    {
        _collection = context.Clients;
    }

    public async Task<Client?> GetByIdAsync(string id)
    {
        return await _collection.Find(c => c.Id == id).FirstOrDefaultAsync();
    }

    public async Task<(IEnumerable<Client> Items, long TotalCount)> GetAllAsync(int page, int pageSize, string? search)
    {
        var filter = BuildSearchFilter(search);
        if (filter == null)
        {
            return (Enumerable.Empty<Client>(), 0);
        }

        var totalCount = await _collection.CountDocumentsAsync(filter);
        
        var items = await _collection.Find(filter)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<string>> FindIdsBySearchAsync(string search, int limit)
    {
        if (string.IsNullOrWhiteSpace(search) || limit <= 0)
        {
            return Array.Empty<string>();
        }

        var filter = BuildSearchFilter(search);
        if (filter == null)
        {
            return Array.Empty<string>();
        }

        var ids = await _collection.Find(filter)
            .Limit(limit)
            .Project(c => c.Id)
            .ToListAsync();

        return ids;
    }

    private static bool IsVenezuelanPhonePattern(string token, string digits)
    {
        if (string.IsNullOrEmpty(digits)) return false;

        if (digits.StartsWith("58") && digits.Length >= 6) return true;

        string[] mobilePrefixesWithZero = { "0414", "0424", "0412", "0422", "0416", "0426" };
        string[] mobilePrefixesWithoutZero = { "414", "424", "412", "422", "416", "426" };

        foreach (var p in mobilePrefixesWithZero)
        {
            if (digits.StartsWith(p)) return true;
        }

        if (digits.Length >= 6)
        {
            foreach (var p in mobilePrefixesWithoutZero)
            {
                if (digits.StartsWith(p)) return true;
            }
        }

        if (digits.StartsWith("02") && digits.Length >= 4) return true;

        if (digits.Length >= 10 && digits.Length <= 12) return true;

        return false;
    }

    private static bool IsCedulaOrRifPattern(string token, string digits)
    {
        if (string.IsNullOrEmpty(digits)) return false;

        var trimmed = token.Trim();
        if (Regex.IsMatch(trimmed, @"^[vVeEjJgGpP][\-\s]?\d+"))
        {
            return true;
        }

        if (digits.Length >= 6 && digits.Length <= 9 && !IsVenezuelanPhonePattern(token, digits))
        {
            return true;
        }

        return false;
    }

    private static FilterDefinition<Client>? BuildSearchFilter(string? search)
    {
        var tokens = AccentInsensitiveRegex.Tokenize(search);
        if (tokens.Length == 0)
        {
            return Builders<Client>.Filter.Empty;
        }

        var tokenFilters = new List<FilterDefinition<Client>>();

        foreach (var token in tokens)
        {
            var regex = AccentInsensitiveRegex.ToBsonRegex(token);
            var digits = new string(token.Where(char.IsDigit).ToArray());
            bool isPhone = IsVenezuelanPhonePattern(token, digits);
            bool isCedula = IsCedulaOrRifPattern(token, digits);
            bool isPureDigits = digits.Length == token.Length;

            var fieldFilters = new List<FilterDefinition<Client>>();

            if (isPhone)
            {
                var phonePattern = @"(^|\D|\+58\D*)" + string.Join(@"\D*", digits.Select(c => Regex.Escape(c.ToString())));
                var phoneRegex = new BsonRegularExpression(phonePattern, "i");
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.Telefono, phoneRegex));
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.Telefono2, phoneRegex));
            }
            else if (isCedula)
            {
                var digitPattern = string.Join(@"\D*", digits.Select(c => Regex.Escape(c.ToString())));
                var digitRegex = new BsonRegularExpression(digitPattern, "i");
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.RutId, digitRegex));
            }
            else if (!isPureDigits)
            {
                // Solo buscar en nombres/apodo/email/rutId cuando el término contiene letras (nombres como "Juan", "Muñoz")
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.NombreRazonSocial, regex));
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.Apodo, regex));
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.Email, regex));
                fieldFilters.Add(Builders<Client>.Filter.Regex(x => x.RutId, regex));
            }

            if (fieldFilters.Count > 0)
            {
                tokenFilters.Add(Builders<Client>.Filter.Or(fieldFilters));
            }
            else
            {
                // Número corto (ej. 208, 690, 2073) que no es teléfono ni cédula: no debe asociar clientes
                return null;
            }
        }

        return Builders<Client>.Filter.And(tokenFilters);
    }

    public async Task<IEnumerable<Client>> GetAllAsync()
    {
        return await _collection.Find(Builders<Client>.Filter.Empty).ToListAsync();
    }

    public async Task<Client?> GetByRutIdAsync(string rutId)
    {
        return await _collection.Find(c => c.RutId == rutId).FirstOrDefaultAsync();
    }

    public async Task<IEnumerable<Client>> GetByEstadoAsync(string estado)
    {
        return await _collection.Find(c => c.Estado == estado).ToListAsync();
    }

    public async Task<Client> CreateAsync(Client client)
    {
        client.FechaCreacion = DateTime.UtcNow;
        await _collection.InsertOneAsync(client);
        return client;
    }

    public async Task<Client> UpdateAsync(Client client)
    {
        await _collection.ReplaceOneAsync(c => c.Id == client.Id, client);
        return client;
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var result = await _collection.DeleteOneAsync(c => c.Id == id);
        return result.DeletedCount > 0;
    }

    public async Task<bool> ExistsAsync(string id)
    {
        var count = await _collection.CountDocumentsAsync(c => c.Id == id);
        return count > 0;
    }

    public async Task<bool> RutIdExistsAsync(string rutId)
    {
        var count = await _collection.CountDocumentsAsync(c => c.RutId == rutId);
        return count > 0;
    }
}

