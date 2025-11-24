using Ordina.Database.Entities.User;

namespace Ordina.Security.Application.Services;

public interface ITokenService
{
    string GenerateToken(User user);
    string GenerateRefreshToken();
}

