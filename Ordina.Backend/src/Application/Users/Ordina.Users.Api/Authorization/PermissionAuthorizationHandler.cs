using Microsoft.AspNetCore.Authorization;

namespace Ordina.Users.Api.Authorization;

public class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User == null)
        {
            return Task.CompletedTask;
        }

        // Los permisos vienen en los claims del token como "permissions"
        // TokenService agrega: new Claim("permissions", permission)
        
        var permissions = context.User.FindAll("permissions").Select(c => c.Value).ToHashSet();
        
        // El Super Administrator tiene acceso total (opcional, si queremos dar bypass)
        var role = context.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role == "Super Administrator")
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        if (permissions.Contains(requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
