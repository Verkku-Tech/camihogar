using Ordina.Database.Entities.User;

namespace Ordina.Security.Application.Services;

public interface ITokenService
{
    string GenerateToken(User user, List<string> permissions);
    string GenerateRefreshToken();
}

