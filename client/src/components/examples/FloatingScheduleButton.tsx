import FloatingScheduleButton from "../FloatingScheduleButton";

export default function FloatingScheduleButtonExample() {
  return (
    <div className="relative h-96 bg-muted/20">
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Scroll to see the button positioned in the bottom-right corner</p>
      </div>
      <FloatingScheduleButton language="en" />
    </div>
  );
}
