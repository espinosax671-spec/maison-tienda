/* ===================================================================
   MAISON — Catálogo de productos de respaldo
   Se usa SOLO si Supabase falla o si la tabla está vacía.
=================================================================== */

const PRODUCTS = [
  {
    id: "demo-1",
    category: "dama",
    name: "Vestido Louis Luigi",
    price: 74000,
    image: "https://via.placeholder.com/400x500?text=Vestido",
    tag: "Nuevo",
    desc: "Vestido hecho directamente por Edna Moda, aka la señora que les hacía los trajes a los superhéroes.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXX"],
  },
  {
    id: "demo-2",
    category: "caballero",
    name: "Camisa clásica",
    price: 89000,
    image: "https://via.placeholder.com/400x500?text=Camisa",
    tag: "",
    desc: "Camisa elegante de corte clásico, perfecta para cualquier ocasión.",
    sizes: ["S", "M", "L", "XL"],
  },
  {
    id: "demo-3",
    category: "calzado",
    name: "Zapatos de gala",
    price: 150000,
    image: "https://via.placeholder.com/400x500?text=Zapatos",
    tag: "Destacado",
    desc: "Zapatos elegantes de cuero, ideales para ocasiones especiales.",
    sizes: ["38", "39", "40", "41", "42", "43"],
  },
];