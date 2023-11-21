import React from 'react'

const Navbar = () => {
  return (
    <header className="flex flex-wrap sm:justify-start sm:flex-nowrap z-50 w-full bg-gray-800 text-sm py-4">
        <nav className="max-w-[85rem] w-full mx-auto px-4 sm:flex sm:items-center sm:justify-between" aria-label="Global">
        <div className="flex items-center justify-between">
            <a className="flex-none text-xl font-semibold dark:text-white" href="#">Mealos</a>
        </div>
        <div className="flex flex-col gap-5 mt-5 sm:flex-row sm:items-center sm:justify-end sm:mt-0 sm:ps-5">
            <p className="font-medium text-gray-100 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"  aria-current="page">Created by the SLHS Tech Office</p>
        </div>
    </nav>
  </header>
  )
}

export default Navbar