import { Input } from "../ui/input";
import { Label } from "../ui/label";

function ImageInput() {
  const name = "image";
  return (
    <div className="mb-2">
      <Label htmlFor={name} className="capitalize">
        Image URL
      </Label>
      <Input
        id={name}
        name={name}
        type="url"
        required
        placeholder="https://images.unsplash.com/..."
        className="max-w-xs"
      />
    </div>
  );
}

export default ImageInput;
