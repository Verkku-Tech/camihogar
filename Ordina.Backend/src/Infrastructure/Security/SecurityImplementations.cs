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

        var trimmedHash = passwordHash.Trim();

        // 1. Coincidencia directa en texto plano (por si la BD tiene contraseñas sin hashear)
        if (password.Equals(trimmedHash, StringComparison.Ordinal))
            return true;

        // 2. Hash BCrypt ($2a$, $2b$, $2y$, etc.)
        if (trimmedHash.StartsWith("$2"))
        {
            try
            {
                if (BCrypt.Net.BCrypt.Verify(password, trimmedHash))
                    return true;
            }
            catch
            {
                // Si el formato no es BCrypt válido, continuar evaluando otros formatos
            }
        }

        // 3. Compatibilidad SHA256 (hex sin guiones, con o sin mayúsculas)
        using var sha256 = SHA256.Create();
        var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
        var hexHash = BitConverter.ToString(hashedBytes).Replace("-", "").ToLowerInvariant();

        var normalizedTargetHash = trimmedHash.Replace("-", "").ToLowerInvariant();
        if (hexHash.Equals(normalizedTargetHash, StringComparison.OrdinalIgnoreCase))
            return true;

        // 4. Compatibilidad SHA256 Base64
        var base64Hash = Convert.ToBase64String(hashedBytes);
        if (base64Hash.Equals(trimmedHash, StringComparison.Ordinal))
            return true;

        return false;
    }
}

public class JwtTokenGenerator : ITokenService
{
    private readonly IConfiguration _configuration;

    public JwtTokenGenerator(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string GenerateToken(User user, IEnumerable<string> permissions, string? impersonatedBy = null)
    {
        var secretKey = _configuration["Jwt:SecretKey"]
                        ?? _configuration["Jwt:Key"]
                        ?? _configuration["Jwt:Secret"]
                        ?? "YourSuperSecretKeyForJWTTokenGenerationThatShouldBeAtLeast32CharactersLong";

        var issuer = _configuration["Jwt:Issuer"] ?? "OrdinaApi";
        var audience = _configuration["Jwt:Audience"] ?? "OrdinaClients";
        var expiryMinutes = int.TryParse(_configuration["Jwt:ExpirationMinutes"] ?? _configuration["Jwt:ExpiryInMinutes"], out var mins) ? mins : 60;

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

        if (!string.IsNullOrWhiteSpace(impersonatedBy))
        {
            claims.Add(new Claim("impersonated_by", impersonatedBy));
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
