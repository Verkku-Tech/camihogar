using Ordina.Users.Application.DTOs;

namespace Ordina.Users.Application.Services;

public interface IUserService
{
    Task<IEnumerable<UserResponseDto>> GetAllUsersAsync(string? status = null);
    Task<UserResponseDto?> GetUserByIdAsync(string id);
    Task<UserResponseDto?> GetUserByUsernameAsync(string username);
    Task<UserResponseDto?> GetUserByEmailAsync(string email);
    Task<UserResponseDto> CreateUserAsync(CreateUserDto createDto);
    Task<UserResponseDto> UpdateUserAsync(string id, UpdateUserDto updateDto);
    Task<bool> DeleteUserAsync(string id);
    Task<bool> UserExistsAsync(string id);
}

