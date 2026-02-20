using Microsoft.Extensions.Logging;
using Ordina.Database.Entities.Role;
using Ordina.Database.Repositories;
using Ordina.Users.Application.DTOs;

namespace Ordina.Users.Application.Services;

public class RoleService : IRoleService
{
    private readonly IRoleRepository _roleRepository;
    private readonly ILogger<RoleService> _logger;

    public RoleService(IRoleRepository roleRepository, ILogger<RoleService> logger)
    {
        _roleRepository = roleRepository;
        _logger = logger;
    }

    public async Task<IEnumerable<RoleResponseDto>> GetAllRolesAsync()
    {
        try
        {
            var roles = await _roleRepository.GetAllAsync();
            return roles.Select(MapToDto);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all roles");
            throw;
        }
    }

    public async Task<RoleResponseDto?> GetRoleByIdAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Role ID is required", nameof(id));
            }

            var role = await _roleRepository.GetByIdAsync(id);
            return role == null ? null : MapToDto(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role by ID {RoleId}", id);
            throw;
        }
    }

    public async Task<RoleResponseDto?> GetRoleByNameAsync(string name)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ArgumentException("Role name is required", nameof(name));
            }

            var role = await _roleRepository.GetByNameAsync(name);
            return role == null ? null : MapToDto(role);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting role by name {RoleName}", name);
            throw;
        }
    }

    public async Task<RoleResponseDto> CreateRoleAsync(CreateRoleDto createDto)
    {
        try
        {
            var existingRole = await _roleRepository.GetByNameAsync(createDto.Name);
            if (existingRole != null)
            {
                throw new InvalidOperationException($"Role with name '{createDto.Name}' already exists");
            }

            var role = new Role
            {
                Name = createDto.Name,
                Permissions = createDto.Permissions ?? new List<string>(),
                IsSystem = false
            };

            var createdRole = await _roleRepository.CreateAsync(role);
            return MapToDto(createdRole);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating role");
            throw;
        }
    }

    public async Task<RoleResponseDto> UpdateRoleAsync(string id, UpdateRoleDto updateDto)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Role ID is required", nameof(id));
            }

            var existingRole = await _roleRepository.GetByIdAsync(id);
            if (existingRole == null)
            {
                throw new KeyNotFoundException($"Role with ID {id} not found");
            }

            if (!string.IsNullOrWhiteSpace(updateDto.Name) && updateDto.Name != existingRole.Name)
            {
                var roleWithName = await _roleRepository.GetByNameAsync(updateDto.Name);
                if (roleWithName != null && roleWithName.Id != id)
                {
                    throw new InvalidOperationException($"Role with name '{updateDto.Name}' already exists");
                }
                existingRole.Name = updateDto.Name;
            }

            if (updateDto.Permissions != null)
            {
                existingRole.Permissions = updateDto.Permissions;
            }

            var updatedRole = await _roleRepository.UpdateAsync(existingRole);
            return MapToDto(updatedRole);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role with ID {RoleId}", id);
            throw;
        }
    }

    public async Task<bool> DeleteRoleAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Role ID is required", nameof(id));
            }

            var role = await _roleRepository.GetByIdAsync(id);
            if (role == null)
            {
                return false;
            }

            if (role.IsSystem)
            {
                throw new InvalidOperationException("Cannot delete system roles");
            }

            return await _roleRepository.DeleteAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting role with ID {RoleId}", id);
            throw;
        }
    }

    public async Task<bool> RoleExistsAsync(string id)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                throw new ArgumentException("Role ID is required", nameof(id));
            }

            return await _roleRepository.ExistsAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking existence of role with ID {RoleId}", id);
            throw;
        }
    }

    private static RoleResponseDto MapToDto(Role role)
    {
        return new RoleResponseDto
        {
            Id = role.Id,
            Name = role.Name,
            Permissions = role.Permissions,
            IsSystem = role.IsSystem,
            CreatedAt = role.CreatedAt,
            UpdatedAt = role.UpdatedAt
        };
    }
}
