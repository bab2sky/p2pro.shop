import { useState } from 'react';
import type { ProductImage } from '@/lib/api/products';

interface ProductImageGalleryProps {
  images: ProductImage[];
  title: string;
}

export function ProductImageGallery({ images, title }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xl">
        No Image
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
        <img
          src={images[activeIndex].image_url}
          alt={title}
          className="w-full h-full object-contain"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(i)}
              className={`w-16 h-16 flex-shrink-0 rounded border-2 overflow-hidden ${
                i === activeIndex ? 'border-blue-600' : 'border-transparent'
              }`}
            >
              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
