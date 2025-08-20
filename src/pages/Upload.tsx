import { Header } from '@/components/layout/Header';
import MultiFileUpload from '@/components/upload/MultiFileUpload';

export default function Upload() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <MultiFileUpload />
    </div>
  );
}