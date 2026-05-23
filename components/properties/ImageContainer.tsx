import Image from "next/image";
import { getSafeImageSrc } from "@/utils/image";

function ImageContainer({
  mainImage,
  name,
}: {
  mainImage: string;
  name: string;
}) {
  const safeImageSrc = getSafeImageSrc(mainImage);
  return (
    <section className="h-[300px] md:h-[400px] relative mt-8">
      <Image
        src={safeImageSrc}
        fill
        sizes="100vw"
        alt={name}
        className="object-cover  rounded-md"
        priority
      />
    </section>
  );
}
export default ImageContainer;