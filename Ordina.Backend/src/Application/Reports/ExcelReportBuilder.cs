using System;
using System.Collections.Generic;
using System.IO;
using ClosedXML.Excel;

namespace Ordina.Application.Reports;

public static class ExcelReportBuilder
{
    public static byte[] CreateTable<T>(
        string worksheetName,
        IReadOnlyList<T> data,
        IReadOnlyList<(string Header, Func<T, object?> Selector)> columns)
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add(worksheetName);

        // Header style with emerald green matching Verkku design system (#1CB569)
        var headerBgColor = XLColor.FromHtml("#1CB569");
        var oddRowColor = XLColor.FromHtml("#F9FAFB");
        var borderColor = XLColor.FromHtml("#E5E7EB");

        // Set headers
        for (int c = 0; c < columns.Count; c++)
        {
            var cell = worksheet.Cell(1, c + 1);
            cell.Value = columns[c].Header;
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = headerBgColor;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = borderColor;
        }

        // Set data rows
        for (int r = 0; r < data.Count; r++)
        {
            var item = data[r];
            int rowNum = r + 2;
            bool isOdd = (r % 2 == 1);

            for (int c = 0; c < columns.Count; c++)
            {
                var cell = worksheet.Cell(rowNum, c + 1);
                var val = columns[c].Selector(item);

                if (val is null)
                {
                    cell.Value = "";
                }
                else if (val is DateTime dt)
                {
                    cell.Value = dt;
                    cell.Style.DateFormat.Format = "yyyy-MM-dd HH:mm";
                }
                else if (val is decimal dec)
                {
                    cell.Value = (double)dec;
                    cell.Style.NumberFormat.Format = "#,##0.00";
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                }
                else if (val is double dbl)
                {
                    cell.Value = dbl;
                    cell.Style.NumberFormat.Format = "#,##0.00";
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                }
                else if (val is int i)
                {
                    cell.Value = i;
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
                }
                else if (val is bool b)
                {
                    cell.Value = b ? "Sí" : "No";
                    cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }
                else
                {
                    cell.Value = val.ToString() ?? "";
                }

                if (isOdd)
                {
                    cell.Style.Fill.BackgroundColor = oddRowColor;
                }

                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.OutsideBorderColor = borderColor;
            }
        }

        worksheet.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }
}
