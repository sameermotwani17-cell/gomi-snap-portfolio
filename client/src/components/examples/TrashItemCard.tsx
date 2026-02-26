import TrashItemCard from "../TrashItemCard";
import { TrashItem } from "@shared/schema";

const mockItem: TrashItem = {
  id: "1",
  nameEn: "PET bottle",
  nameJa: "ペットボトル",
  aliases: ["plastic bottle", "pet"],
  category: "recyclable",
  bagColor: "Yellow",
  instructionsEn: "Rinse, remove cap and label",
  instructionsJa: "洗って、キャップとラベルを取る"
};

export default function TrashItemCardExample() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <TrashItemCard item={mockItem} language="en" />
      <TrashItemCard item={mockItem} language="ja" />
    </div>
  );
}
