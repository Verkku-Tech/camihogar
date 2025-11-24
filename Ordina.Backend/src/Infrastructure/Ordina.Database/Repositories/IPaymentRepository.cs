using Ordina.Database.Entities.Payment;

namespace Ordina.Database.Repositories;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(string id);
    Task<IEnumerable<Payment>> GetAllAsync();
    Task<IEnumerable<Payment>> GetByOrderIdAsync(string orderId);
    Task<IEnumerable<Payment>> GetByStatusAsync(string status);
    Task<Payment> CreateAsync(Payment payment);
    Task<Payment> UpdateAsync(Payment payment);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}

