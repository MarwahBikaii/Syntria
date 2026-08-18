export default function Header() {
  return (
    <div className="container shadow-sm bg-base-100  max-w-[1400px] mx-auto px-8">
    <div className="navbar px-0">
      <div className="flex-1">
        <a className="btn btn-ghost text-xl">
          Syntria
        </a>
      </div>

      <div className="flex-none">
        <ul className="menu menu-horizontal px-1">
          <li>
            <a>Contact Us</a>
          </li>

          <li>
            <details>
              <summary>About Us</summary>

              <ul className="bg-base-100 rounded-t-none p-2">
                <li>
                  <a>Impact</a>
                </li>

                <li>
                  <a>Common Questions</a>
                </li>
              </ul>

           

            </details>
          </li>
               <li>
            <button className="btn btn-primary">Get Started</button>
          </li>
        </ul>
      </div></div></div>
  
  );
}