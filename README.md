# Nail Studio - App de Gestión

![Nail Studio Logo](public/NailStudio.png)

**Nail Studio** es una aplicación Web (PWA) diseñada y pensada exclusivamente para facilitar el trabajo diario de salones de uñas y manicuristas independientes. Organiza información, clientes y citas en un solo lugar sin complicaciones.

## 💅 Características Principales

- **Gestión de Clientes:** Registra sus datos, visualiza el historial de tratamientos y contáctalos fácilmente.
- **Calendario de Citas:** Agrega, modifica y visualiza tus citas de manera interactiva.
- **Catálogo de Servicios:** Crea servicios con su respectivo precio y tiempo de duración.
- **Inventario:** Lleva el control de tus materiales y el costo que generan.
- **Finanzas y Reportes:** Gráficos intuitivos para medir ingresos diarios, mensuales y el rendimiento de tus esmaltes e insumos.
- **Diseño Moderno:** Estética atractiva, optimizada para uso en dispositivos móviles y totalmente responsiva.

## 🛠 Tecnologías Utilizadas

- **React:** Construcción de la interfaz de usuario.
- **Vite:** Empaquetador extremadamente rápido (build tool).
- **TypeScript:** Tipado estático para un desarrollo más seguro y libre de errores.
- **Tailwind CSS:** Diseño del sistema de componentes flexible y estilizado con soporte de modos oscuros/claros y utilidades visuales potentes.
- **Recharts:** Generación de gráficos simples, accesibles y fluidos para los reportes financieros.
- **Framer Motion:** Animaciones sutiles y transiciones de pantalla que brindan una experiencia de usuario premium (fluid UX).

## 🚀 Instalación y Puesta en Marcha

Sigue estos pasos para arrancar el proyecto en tu entorno de desarrollo local.

1. **Clonar el repositorio:** (si aplica)

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd nailsoft
   ```

2. **Instalar dependencias:**

   ```bash
   npm install
   ```

   _Nota: Se generaron favicons usando `sharp`, entre otras dependencias críticas._

3. **Iniciar el Servidor de Desarrollo:**

   ```bash
   npm run dev
   ```

   El servidor arrancará en `http://localhost:5173/` (o en otro puerto disponible).

4. **Construir para Producción:**
   Para desplegar la aplicación en un entorno de producción (ej. Vercel, Netlify o GitHub Pages):
   ```bash
   npm run build
   ```
   Los archivos estáticos listos para subir estarán en la carpeta `dist/`.

## ⚙️ Estructura de Directorios

```text
/
├── public/                 # Archivos PWA (favicon, manifest, robots.txt, sitemap.xml)
├── src/
│   ├── components/         # Componentes visuales y lógicos (Finanzas, Reportes, Clientes, etc.)
│   ├── store/              # Estado global de la aplicación (Zustand, Redux, Context, etc.)
│   ├── types/              # Definiciones de tipo para TypeScript
│   ├── App.tsx             # Raíz de la aplicación y sistema de enrutamiento principal
│   └── main.tsx            # Punto de entrada de React
├── index.html              # Plantilla HTML y SEO principal optimizado
├── tailwind.config.js      # Configuración de los estilos de Tailwind CSS
├── tsconfig.json           # Reglas de compilación para TypeScript
└── vite.config.ts          # Configuración de ViteJS
```

## 📝 Soporte y Contribuciones

Si tienes dudas sobre el desarrollo de cualquier componente de _Nail Studio_, revisa el historial de cambios, levanta un Issue en el repositorio y nos comunicaremos lo antes posible.

---
