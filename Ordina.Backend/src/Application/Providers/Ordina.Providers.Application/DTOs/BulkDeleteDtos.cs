namespace Ordina.Providers.Application.DTOs;

public class BulkDeleteRequestDto
{
    public List<string> Ids { get; set; } = new();
}

public class BulkDeleteResultDto
{
    public int Deleted { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = new();
}
