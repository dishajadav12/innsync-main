import NavSearch from "./NavSearch";
import LinksDropdown from "./LinksDropdown";
import DarkMode from "./DarkMode";
import Logo from "./Logo";
import MobileSearchButton from "./MobileSearchButton";

function Navbar() {
  return (
    <nav className="border-b">
      <div className="container flex items-center gap-3 py-5">
        <Logo />
        <div className="hidden md:block md:flex-1 md:max-w-xs">
          <NavSearch />
        </div>
        <div className="ml-auto flex gap-3 items-center">
          <MobileSearchButton />
          <div className="hidden md:block">
            <DarkMode />
          </div>
          <LinksDropdown />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
