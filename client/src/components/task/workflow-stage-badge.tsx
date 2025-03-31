import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WorkflowStageBadgeProps {
  workflowName: string;
  stageName: string;
  stageColor?: string;
  className?: string;
}

/**
 * A consistent badge for displaying workflow and stage information
 */
export function WorkflowStageBadge({ 
  workflowName, 
  stageName, 
  stageColor = '#4444FF',
  className 
}: WorkflowStageBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("flex items-center gap-1", className)}
      style={{
        borderColor: stageColor,
        color: stageColor
      }}
    >
      {workflowName} - {stageName}
    </Badge>
  );
}