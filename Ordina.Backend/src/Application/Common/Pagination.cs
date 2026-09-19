namespace Ordina.Application.Common;

public record PagedRequest(
    int Page = 1,
    int PageSize = 20,
    string? SearchTerm = null,
    string? SortBy = null,
    bool SortDescending = false);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;
    public bool HasPreviousPage => Page > 1;
    public bool HasNextPage => Page < TotalPages;
}

public record Result<T>(
    bool IsSuccess,
    T? Value = default,
    string? Error = null,
    int StatusCode = 200)
{
    public static Result<T> Success(T value, int statusCode = 200) => new(true, value, null, statusCode);
    public static Result<T> Failure(string error, int statusCode = 400) => new(false, default, error, statusCode);
}
