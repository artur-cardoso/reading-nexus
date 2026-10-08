const OPEN_LIBRARY = 'https://openlibrary.org/search.json'
const WIKI = 'https://pt.wikipedia.org/w/api.php'

export async function searchBooks(query) {
  const url = `${OPEN_LIBRARY}?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,first_publish_year,cover_i,isbn,pages_num`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível pesquisar livros agora.')
  const data = await response.json()

  return (data.docs || []).map(book => ({
    externalId: book.key,
    title: book.title || 'Sem título',
    author: book.author_name?.[0] || 'Autor desconhecido',
    year: book.first_publish_year || null,
    totalPages: book.pages_num?.[0] || null,
    isbn: book.isbn?.[0] || null,
    coverUrl: book.cover_i
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
      : null
  }))
}

export async function enrichWithWikipedia(title, author = '') {
  const term = `${title}${author ? ` ${author}` : ''}`
  const url = `${WIKI}?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=0&gsrlimit=3&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=700&format=json&origin=*`
  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  const pages = Object.values(data.query?.pages || {})
  if (!pages.length) return null
  const page = pages[0]

  return {
    summary: page.extract || null,
    wikipediaUrl: `https://pt.wikipedia.org/?curid=${page.pageid}`,
    thumbnail: page.thumbnail?.source || null,
    wikipediaTitle: page.title || null
  }
}
