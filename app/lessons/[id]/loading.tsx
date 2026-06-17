// Student-app "10B" loading screen — full sky, centred white logo, three
// bouncing white dots (brief §9). Server component; no data fetch.
export default function LessonLoading() {
  return (
    <main className="min-h-screen bg-sky flex flex-col items-center justify-center gap-8">
      <img src="/logo-onblue.png" alt="English with Laura" className="h-28" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 bg-white rounded-full animate-bounce-dot"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </main>
  )
}
