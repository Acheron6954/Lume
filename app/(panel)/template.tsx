// Her sayfa geçişinde yeniden oluşur: yeni sayfa aşağıdan süzülerek gelir (stil: .page-enter).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
