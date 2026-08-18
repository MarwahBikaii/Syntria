export default function Contactus(){
    return(
        <div className="container flex flex-col justify-center items-center">
            <h1 className="text-4xl font-bold text-[#c44b0e] text-center mr-10">
                Contact Us
            </h1>

             <form className="p-10 w-full">
            <label className="input validator w-full">
          <svg className="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <g
      strokeLinejoin="round"
      strokeLinecap="round"
      strokeWidth="2.5"
      fill="none"
      stroke="currentColor"
    >
      <rect width="20" height="16" x="2" y="4" rx="2"></rect>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
    </g>
  </svg>
  <input type="email" placeholder="mail@site.com" required />
</label>
<div className="validator-hint hidden">Enter valid email address</div>

<fieldset className="fieldset">
  <label className="label w-full" htmlFor="Subject">Subject</label>
  <input type="text" id="name" className="input w-full" placeholder="Subject" />
</fieldset>

<fieldset className="fieldset w-full">
  <legend className="fieldset-legend">Your Message</legend>
  <textarea className="textarea h-24 w-full" placeholder="Message"></textarea>
</fieldset>
</form>
        </div>
    )
}