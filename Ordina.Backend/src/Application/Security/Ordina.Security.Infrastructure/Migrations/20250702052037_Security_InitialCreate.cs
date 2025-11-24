using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Ordina.Security.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Security_InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "security");

            migrationBuilder.CreateTable(
                name: "Permissions",
                schema: "security",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, defaultValueSql: "NOW()"),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Permissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                schema: "security",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true, defaultValueSql: "NOW()"),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RolePermissions",
                schema: "security",
                columns: table => new
                {
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    PermissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RolePermissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_RolePermissions_Permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalSchema: "security",
                        principalTable: "Permissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RolePermissions_Roles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "security",
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "security",
                table: "Permissions",
                columns: new[] { "Id", "CreatedAt", "Description", "IsActive", "Name", "UpdatedAt" },
                values: new object[,]
                {
                    { new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1462), "Leer información de usuarios", true, "users.read", new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1630) },
                    { new Guid("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1812), "Crear y editar usuarios", true, "users.write", new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1813) },
                    { new Guid("cccccccc-cccc-cccc-cccc-cccccccccccc"), new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1815), "Leer pedidos", true, "orders.read", new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1816) },
                    { new Guid("dddddddd-dddd-dddd-dddd-dddddddddddd"), new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1817), "Crear y gestionar pedidos", true, "orders.write", new DateTime(2025, 7, 2, 5, 20, 35, 820, DateTimeKind.Utc).AddTicks(1818) }
                });

            migrationBuilder.InsertData(
                schema: "security",
                table: "Roles",
                columns: new[] { "Id", "CreatedAt", "Description", "IsActive", "Name", "UpdatedAt" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(4560), "Administrador del sistema con acceso completo", true, "Administrator", new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(4729) },
                    { new Guid("22222222-2222-2222-2222-222222222222"), new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(5004), "Gerente de tienda con permisos de gestión", true, "Manager", new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(5005) },
                    { new Guid("33333333-3333-3333-3333-333333333333"), new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(5008), "Empleado con permisos básicos", true, "Employee", new DateTime(2025, 7, 2, 5, 20, 35, 819, DateTimeKind.Utc).AddTicks(5009) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_CreatedAt",
                schema: "security",
                table: "Permissions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Permissions_Name",
                schema: "security",
                table: "Permissions",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_CreatedAt",
                schema: "security",
                table: "RolePermissions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_PermissionId",
                schema: "security",
                table: "RolePermissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_RolePermissions_RoleId",
                schema: "security",
                table: "RolePermissions",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_CreatedAt",
                schema: "security",
                table: "Roles",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                schema: "security",
                table: "Roles",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RolePermissions",
                schema: "security");

            migrationBuilder.DropTable(
                name: "Permissions",
                schema: "security");

            migrationBuilder.DropTable(
                name: "Roles",
                schema: "security");
        }
    }
}
