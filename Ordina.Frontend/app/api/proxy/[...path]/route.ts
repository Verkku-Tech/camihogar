import { NextRequest, NextResponse } from 'next/server';

// URLs base de las APIs (sin NEXT_PUBLIC porque son del servidor)
const API_BASE_URLS: Record<string, string> = {
  security: process.env.SECURITY_API_URL || 'http://camihogar.eastus.cloudapp.azure.com:8082',
  users: process.env.USERS_API_URL || 'http://camihogar.eastus.cloudapp.azure.com:8083',
  providers: process.env.PROVIDERS_API_URL || 'http://camihogar.eastus.cloudapp.azure.com:8084',
  orders: process.env.ORDERS_API_URL || process.env.NEXT_PUBLIC_ORDERS_API_URL || 'http://camihogar.eastus.cloudapp.azure.com:8085',
};

async function handleRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string
) {
  const [service, ...rest] = params.path;
  const apiBaseUrl = API_BASE_URLS[service];
  
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: 'Invalid service. Available services: security, users, providers, orders' },
      { status: 400 }
    );
  }

  // Construir el path completo del endpoint
  // rest puede ser: ['api', 'Orders'] o ['Orders'] dependiendo de cómo venga del api-client
  // Normalizar para que siempre tenga /api/ al inicio
  let path: string;
  if (rest[0] === 'api') {
    // Ya viene con /api/: ['api', 'Orders'] → /api/Orders
    path = `/${rest.join('/')}`;
  } else {
    // No viene con /api/: ['Orders'] → /api/Orders
    path = `/api/${rest.join('/')}`;
  }
  
  const searchParams = request.nextUrl.search;
  const url = `${apiBaseUrl}${path}${searchParams}`;

  // Preparar headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Copiar Authorization header si existe
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  // Obtener body si existe (para POST, PUT, PATCH)
  let body: string | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    try {
      body = await request.text();
    } catch {
      // No body o error al leerlo
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    // Detectar si es un archivo binario (Excel, PDF, imágenes, etc.)
    const contentType = response.headers.get('Content-Type') || '';
    const isBinary = contentType.includes('application/vnd.openxmlformats-officedocument') ||
                     contentType.includes('application/pdf') ||
                     contentType.includes('application/octet-stream') ||
                     contentType.includes('image/') ||
                     contentType.includes('application/excel') ||
                     contentType.includes('application/x-excel') ||
                     contentType.includes('application/x-msexcel');

    if (isBinary) {
      // Para archivos binarios, devolver el blob directamente
      const blob = await response.blob();
      
      // Copiar headers importantes de la respuesta
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', contentType);
      
      // Copiar content-disposition si existe (para el nombre del archivo)
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        responseHeaders.set('Content-Disposition', contentDisposition);
      }
      
      return new NextResponse(blob, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Para respuestas JSON o texto, manejar como antes
    const data = await response.text();
    let jsonData: any;
    try {
      jsonData = JSON.parse(data);
    } catch {
      // Si no es JSON, devolver el texto
      jsonData = data || null;
    }

    // Copiar headers importantes de la respuesta
    const responseHeaders = new Headers();
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }

    return NextResponse.json(jsonData, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Proxy error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params, 'PATCH');
}

