using System.ComponentModel.DataAnnotations;

namespace Ordina.Providers.Application.Validation;

/// <summary>
/// Valida formato de email solo cuando el valor no es null ni vacío.
/// </summary>
public sealed class OptionalEmailAddressAttribute : ValidationAttribute
{
    private static readonly EmailAddressAttribute Inner = new();

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string s || string.IsNullOrWhiteSpace(s))
            return ValidationResult.Success;

        return Inner.IsValid(s.Trim())
            ? ValidationResult.Success
            : new ValidationResult(ErrorMessage ?? "The Email field is not a valid e-mail address.");
    }
}
