export default function SiteFooter(): JSX.Element {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span>&copy; {new Date().getFullYear()} Eventra</span>
        <span>CSC473 Project</span>
      </div>
    </footer>
  );
}
