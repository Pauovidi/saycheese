export interface PressArticle {
  id: string
  title: string
  slug: string
  outlet: string
  date: string
  excerpt: string
  image: string
  content: string
}

export const pressArticles: PressArticle[] = [
  {
    id: "1",
    title: "SayCheese: la galería de arte que se come",
    slug: "saycheese-galeria-arte-que-se-come",
    outlet: "El País Gastro",
    date: "2025-11-15",
    excerpt:
      "Un concepto que fusiona pastelería artesana con estética de galería de arte. SayCheese ha conseguido que comprar una cheesecake se sienta como adquirir una obra maestra.",
    image: "/images/gallery-1.jpg",
    content:
      "Cuando entras en SayCheese, lo primero que notas es el silencio. No es el bullicio habitual de una pastelería, sino la calma reverencial de una galería de arte. Y eso es exactamente lo que pretenden sus creadores. Cada cheesecake se presenta como una pieza única, con su propia ficha técnica, su historia y su razón de ser. La cheesecake clásica, su obra insignia, ha sido premiada como una de las mejores del país. Pero aquí no se trata solo de sabor: se trata de la experiencia completa.",
  },
  {
    id: "2",
    title: "Las 10 mejores cheesecakes del año",
    slug: "10-mejores-tartas-queso-ano",
    outlet: "Traveler Magazine",
    date: "2025-10-02",
    excerpt:
      "En nuestra selección anual, SayCheese ocupa un lugar destacado con su cheesecake clásica y su innovadora versión de pistacho.",
    image: "/images/gallery-2.jpg",
    content:
      "Cada año seleccionamos las mejores cheesecakes del panorama gastronómico nacional. Este año, SayCheese nos ha sorprendido no solo por la calidad extraordinaria de su cheesecake clásica —un interior cremoso con un punto de mascarpone que la hace irresistible—, sino también por su versión de pistacho, que incorpora pistacho tostado 100% y consigue un equilibrio perfecto entre lo salado y lo dulce.",
  },
  {
    id: "3",
    title: "El fenómeno SayCheese arrasa en redes",
    slug: "fenomeno-saycheese-arrasa-redes",
    outlet: "Vogue Living",
    date: "2025-09-20",
    excerpt:
      "Con más de 200.000 seguidores en redes, SayCheese se ha convertido en el fenómeno pastelero del momento gracias a su estética impecable.",
    image: "/images/gallery-1.jpg",
    content:
      "No es solo una pastelería, es un fenómeno cultural. SayCheese ha conquistado las redes sociales con una estrategia visual impecable: fotografías en blanco y negro, tipografías mayúsculas, y un concepto de 'galería de arte comestible' que ha calado hondo en una generación que valora tanto la estética como el sabor. Sus cheesecakes se agotan cada semana y la lista de espera para pedidos personalizados supera ya las tres semanas.",
  },
  {
    id: "4",
    title: "Pastelería de autor: la nueva tendencia",
    slug: "pasteleria-autor-nueva-tendencia",
    outlet: "Forbes Lifestyle",
    date: "2025-08-10",
    excerpt:
      "SayCheese lidera una nueva ola de pastelerías de autor donde el producto se eleva a la categoría de arte.",
    image: "/images/gallery-2.jpg",
    content:
      "La pastelería artesana está viviendo una revolución. Marcas como SayCheese están redefiniendo lo que significa comprar un dulce, elevando cada producto a la categoría de pieza de autor. Con ingredientes de primera calidad, presentaciones impecables y un storytelling que conecta emocionalmente con el consumidor, estas nuevas pastelerías están demostrando que hay espacio para la excelencia en un mercado saturado.",
  },
  {
    id: "5",
    title: "Entrevista: los creadores de SayCheese",
    slug: "entrevista-creadores-saycheese",
    outlet: "Bon Viveur",
    date: "2025-07-05",
    excerpt:
      "Hablamos con los fundadores de SayCheese sobre su filosofía, sus ingredientes y por qué no quieren que compartas su cheesecake.",
    image: "/images/gallery-1.jpg",
    content:
      "Nos reciben en su obrador con una sonrisa y una porción de su cheesecake de pistacho. 'La idea siempre fue crear algo que la gente quisiera guardar solo para sí misma', nos cuentan. 'Cuando alguien prueba uno de nuestros cheesecakes y su primera reacción es esconderlo para que nadie más lo pruebe, sabemos que hemos hecho bien nuestro trabajo'. Su filosofía se resume en una palabra: egoísmo gastronómico.",
  },
]

export function getArticleBySlug(slug: string): PressArticle | undefined {
  return pressArticles.find((a) => a.slug === slug)
}
