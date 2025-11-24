using Ordina.Database.Entities.Payment;

namespace Ordina.Database.Repositories;

public interface IPaymentMethodRepository
{
    Task<PaymentMethod?> GetByIdAsync(string id);
    Task<IEnumerable<PaymentMethod>> GetAllAsync();
    Task<IEnumerable<PaymentMethod>> GetActiveAsync();
    Task<PaymentMethod?> GetByNameAsync(string name);
    Task<PaymentMethod> CreateAsync(PaymentMethod paymentMethod);
    Task<PaymentMethod> UpdateAsync(PaymentMethod paymentMethod);
    Task<bool> DeleteAsync(string id);
    Task<bool> ExistsAsync(string id);
}

