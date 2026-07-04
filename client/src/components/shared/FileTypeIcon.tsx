import {
  FileText, FileImage, FileVideo2, FileAudio, FileArchive,
  FileCode, File, FileSpreadsheet, Presentation,
} from 'lucide-react';

interface FileTypeIconProps {
  mimeType: string;
  category: string;
  size?: number;
}

export function FileTypeIcon({ mimeType, category, size = 24 }: FileTypeIconProps) {
  const getIcon = () => {
    switch (category) {
      case 'image': return <FileImage size={size} />;
      case 'video': return <FileVideo2 size={size} />;
      case 'audio': return <FileAudio size={size} />;
      case 'pdf': return <FileText size={size} />;
      case 'archive': return <FileArchive size={size} />;
      case 'text': return <FileCode size={size} />;
      case 'document':
        if (mimeType.includes('sheet') || mimeType.includes('excel'))
          return <FileSpreadsheet size={size} />;
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
          return <Presentation size={size} />;
        return <FileText size={size} />;
      default: return <File size={size} />;
    }
  };

  const colorClass = `file-type-${category}`;

  return (
    <div className={`file-card-icon ${colorClass}`} style={{
      width: size + 24, height: size + 24,
      borderRadius: 'var(--radius-md)',
    }}>
      {getIcon()}
    </div>
  );
}
