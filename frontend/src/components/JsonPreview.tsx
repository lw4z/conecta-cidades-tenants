import { useState } from 'react'

interface JsonPreviewProps {
  data: unknown
}

export default function JsonPreview({ data }: JsonPreviewProps) {
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(data, null, 2)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 rounded-md bg-gray-700 px-2 py-1 text-xs text-white hover:bg-gray-600"
      >
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
      <pre className="max-h-96 overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-green-400">
        {json}
      </pre>
    </div>
  )
}
