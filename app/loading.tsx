export default function Loading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-32 h-32 bg-gray-200 rounded-2xl mb-4" />
        <div className="h-3 w-48 bg-gray-200 rounded mb-8" />
        <div className="w-full max-w-sm space-y-3">
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-200 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </main>
  )
}
