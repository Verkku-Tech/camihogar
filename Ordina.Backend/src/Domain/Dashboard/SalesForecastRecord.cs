using MongoDB.Bson.Serialization.Attributes;
using Ordina.Domain.Common;

namespace Ordina.Domain.Dashboard;

public class SalesForecastRecord : BaseEntity
{
    [BsonElement("versionNumber")]
    public int VersionNumber { get; set; }

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("period")]
    public string Period { get; set; } = "month";

    [BsonElement("weekOffset")]
    public int WeekOffset { get; set; }

    [BsonElement("startDate")]
    public DateTime StartDate { get; set; }

    [BsonElement("endDate")]
    public DateTime EndDate { get; set; }

    [BsonElement("projectionsHash")]
    public string ProjectionsHash { get; set; } = string.Empty;

    [BsonElement("points")]
    public List<ForecastRecordPoint> Points { get; set; } = new();

    [BsonElement("summary")]
    public ForecastRecordSummary Summary { get; set; } = new();
}

public class ForecastRecordPoint
{
    [BsonElement("date")]
    public string Date { get; set; } = string.Empty;

    [BsonElement("label")]
    public string Label { get; set; } = string.Empty;

    [BsonElement("actualInvoiced")]
    public decimal? ActualInvoiced { get; set; }

    [BsonElement("actualCollected")]
    public decimal? ActualCollected { get; set; }

    [BsonElement("projectedInvoiced")]
    public decimal ProjectedInvoiced { get; set; }

    [BsonElement("projectedCollected")]
    public decimal ProjectedCollected { get; set; }

    [BsonElement("benchmark")]
    public decimal? Benchmark { get; set; }
}

public class ForecastRecordSummary
{
    [BsonElement("projectedInvoicedTotal")]
    public decimal ProjectedInvoicedTotal { get; set; }

    [BsonElement("projectedCollectedTotal")]
    public decimal ProjectedCollectedTotal { get; set; }

    [BsonElement("realInvoicedTotal")]
    public decimal RealInvoicedTotal { get; set; }

    [BsonElement("realCollectedTotal")]
    public decimal RealCollectedTotal { get; set; }

    [BsonElement("benchmarkTotal")]
    public decimal? BenchmarkTotal { get; set; }

    [BsonElement("mapeScore")]
    public double MapeScore { get; set; }
}
