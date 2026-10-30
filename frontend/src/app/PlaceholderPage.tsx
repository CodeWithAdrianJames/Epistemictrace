interface PlaceholderPageProps {
  title: string
}

// Stands in for a page until its feature spec builds the real content.
function PlaceholderPage({ title }: PlaceholderPageProps) {
  return <h1>{title}</h1>
}

export default PlaceholderPage
