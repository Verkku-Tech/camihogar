namespace Ordina.Users.Application.DTOs;

public class ImportClientsResultDto
{
    public string Message { get; set; } = string.Empty;
    public int RowsProcessed { get; set; }
    public int Errors { get; set; }
    public int Total { get; set; }
}
