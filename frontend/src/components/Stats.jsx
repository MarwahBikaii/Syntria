export default function Stats(){
    return(
        <div className="container mx-auto  flex justify-center gap-10 mb-15">
        <div className="stats shadow p-4">
  <div className="stat">
    <div className="stat-figure text-primary">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="inline-block h-8 w-8 stroke-current"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        ></path>
      </svg>
    </div>
    <div className="stat-title">Total issue supported by different community members</div>
    <div className="stat-value text-primary">25.6K</div>
    <div className="stat-desc">21% more than last month</div>
  </div>

  <div className="stat">
    <div className="stat-figure text-[#c44b0e]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        className="inline-block h-8 w-8 stroke-current"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        ></path>
      </svg>
    </div>
    <div className="stat-title">Real Impact</div>
    <div className="stat-value text-[#c44b0e]">2.6M</div>
    <div className="stat-desc">30% more initiatives done</div>
  </div>

  <div className="stat">
    <div className="stat-figure text-secondary">
      <div className="avatar avatar-online">
  
      </div>
    </div>
    <div className="stat-title">Growth</div>
    <div className="stat-value">86%</div>
    <div className="stat-title">Initiatives done</div>
    <div className="stat-desc text-[#c44b0e]">31 tasks remaining till now</div>
  </div>
</div></div>
    )
}