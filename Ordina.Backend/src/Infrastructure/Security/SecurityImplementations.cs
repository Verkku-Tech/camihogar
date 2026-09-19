using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Ordina.Application.Security;
using Ordina.Domain.Users;

namespace Ordina.Infrastructure.Security;

public class PasswordHasher : IPasswordHasher
{
    public string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11);
    }

    public bool VerifyPassword(string password, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(passwordHash))
            return false;

        // Si comienza con $2a$, $2b$ o $2y$, es un hash de BCrypt
        if (passwordHash.StartsWith("$2"))
        {
            try
            {
                return BCrypt.Net.BCrypt.Verify(password, passwordHash);
            }
            catch
            {
                return false;
            }
        }

        // Compatibilidad retroactiva: verificar SHA256 hex para contraseñas preexistentes en la base de datos
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var hexHash = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();

        return hexHash.Equals(passwordHash, StringComparison.OrdinalIgnoreCase);
    }
}

public class JwtTokenGenerator : ITokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenGenerator(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user, IEnumerable<string> permissions)
    {
        var secretKey = _configuration["Jwt:Key"]
                        ?? _configuration["Jwt:Secret"]
                        ?? "OrdinaSecureSecretKeyForDevelopmentAndTestingOnly!123456789";

        var issuer = _configuration["Jwt:Issuer"] ?? "Ordina.Api";
        var audience = _configuration["Jwt:Audience"] ?? "OrdinaApp";
        var expiryMinutes = int.TryParse(_configuration["Jwt:ExpiryInMinutes"], out var mins) ? mins : 15;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.RoleString),
            new("name", user.Name)
        };

        if (!string.IsNullOrWhiteSpace(user.StoreId))
        {
            claims.Add(new Claim("storeId", user.StoreId));
        }

        if (!string.IsNullOrWhiteSpace(user.StoreName))
        {
            claims.Add(new Claim("storeName", user.StoreName));
        }

        foreach (var permission in permissions)
        {
            claims.Add(new Claim("permission", permission));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }
}
