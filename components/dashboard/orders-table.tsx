"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

const orders = [
  {
    id: "123-1233849-12381239",
    subtotal: "$700,00",
    date: "09/11/2021",
    client: "John Doe",
  },
  {
    id: "932-1231234-23890283",
    subtotal: "$700,00",
    date: "29/10/2021",
    client: "John Doe",
  },
  {
    id: "854-2138534-38907534",
    subtotal: "$700,00",
    date: "22/10/2021",
    client: "John Doe",
  },
  {
    id: "584-1232356-38907434",
    subtotal: "$700,00",
    date: "15/10/2021",
    client: "John Doe",
  },
]

export function OrdersTable() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium text-muted-foreground">Pedido</TableHead>
                <TableHead className="font-medium text-muted-foreground">Subtotal</TableHead>
                <TableHead className="font-medium text-muted-foreground">Fecha Creación</TableHead>
                <TableHead className="font-medium text-muted-foreground">Cliente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-green-600">{order.id}</TableCell>
                  <TableCell className="font-medium">{order.subtotal}</TableCell>
                  <TableCell className="text-muted-foreground">{order.date}</TableCell>
                  <TableCell className="text-green-600 font-medium">{order.client}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
