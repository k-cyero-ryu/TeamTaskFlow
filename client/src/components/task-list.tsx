import { Task } from "@shared/schema";
import { useState, useRef, useEffect } from "react";
import TaskCard from "./task-card";
import { ErrorBoundary } from "./error-boundary";
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExtendedTask } from "@/lib/types";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AutoSizer, List, WindowScroller, CellMeasurer, CellMeasurerCache } from 'react-virtualized';

interface TaskListProps {
  tasks: ExtendedTask[];
  limit?: number;
  isLoading?: boolean;
  error?: Error | null;
}

// Main component wrapped with error boundary
export default function TaskList(props: TaskListProps) {
  return (
    <ErrorBoundary 
      fallback={<TaskListError />}
      showToast={false}
    >
      <TaskListContent {...props} />
    </ErrorBoundary>
  );
}

// Error state component
function TaskListError() {
  return (
    <div 
      className="space-y-6 p-4 border rounded-lg bg-background"
      role="alert"
      aria-labelledby="error-heading"
    >
      <div className="space-y-2 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" aria-hidden="true" />
        <h3 id="error-heading" className="text-xl font-semibold">Unable to Load Tasks</h3>
        <p className="text-muted-foreground">
          We encountered a problem while trying to load your tasks. This could be due to a network issue or a temporary server problem.
        </p>
      </div>
      
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Connection Error</AlertTitle>
        <AlertDescription>
          The task list could not be retrieved. Please check your network connection and try again.
        </AlertDescription>
      </Alert>
      
      <div className="flex justify-center gap-4">
        <Button 
          onClick={() => window.location.reload()}
          variant="default"
          className="flex items-center gap-2"
          aria-label="Reload page to try again"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> 
          <span>Reload Page</span>
        </Button>
      </div>
    </div>
  );
}

// Empty state component
function EmptyTaskList() {
  return (
    <div 
      className="text-center p-8 border border-dashed rounded-lg"
      role="region"
      aria-label="Empty task list"
    >
      <div className="space-y-3">
        <div className="relative mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-medium" id="empty-task-heading">No Tasks Found</h3>
        <p 
          className="text-sm text-muted-foreground max-w-sm mx-auto"
          aria-describedby="empty-task-heading"
        >
          There are currently no tasks in this view. Create a new task to get started with your project.
        </p>
        <Button 
          variant="outline" 
          onClick={() => document.querySelector<HTMLButtonElement>('button:has(.h-4.w-4.mr-2)')?.click()}
          aria-label="Create your first task"
        >
          Create Your First Task
        </Button>
      </div>
    </div>
  );
}

// Main content component with proper error states and pagination
function TaskListContent({ tasks, limit, isLoading, error }: TaskListProps) {
  // Create a ref for the List component
  const listRef = useRef<List | null>(null);
  
  // Create cell measurer cache to handle different sized items
  const cache = useRef(new CellMeasurerCache({
    defaultHeight: 280, // Default height based on typical TaskCard
    minHeight: 200,     // Minimum height to prevent initial layout shifts
    fixedWidth: true,
    keyMapper: (index) => tasks[index]?.id || index,
  }));
  
  // Determine display mode based on limit prop
  const usePagination = limit !== undefined && limit < tasks.length;
  const useVirtualization = !usePagination && tasks.length > 9; // Use virtualization for large non-limited lists
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = limit || 9; // Default to 9 items per page if no limit is provided
  
  // Handle explicit error from props
  if (error) {
    return <TaskListError />;
  }
  
  // Handle empty state 
  if (!isLoading && (!tasks || tasks.length === 0)) {
    return <EmptyTaskList />;
  }

  // Calculate pagination values if using pagination
  const totalItems = tasks.length;
  const totalPages = usePagination ? Math.ceil(totalItems / itemsPerPage) : 1;
  const startIndex = usePagination ? (currentPage - 1) * itemsPerPage : 0;
  const endIndex = usePagination ? Math.min(startIndex + itemsPerPage, totalItems) : totalItems;
  const displayTasks = usePagination ? tasks.slice(startIndex, endIndex) : tasks;
  
  // Reset cache when tasks change
  useEffect(() => {
    cache.current.clearAll();
    if (listRef.current) {
      listRef.current.recomputeRowHeights();
    }
  }, [tasks]);

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    // Ensure page number is within bounds
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      // Scroll to top of the task list for better UX
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate an array of page numbers to display
  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5; // Max number of page links to show
    
    if (totalPages <= maxVisiblePages) {
      // If we have fewer pages than max visible, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Always show first page
      pageNumbers.push(1);
      
      // Calculate start and end of visible page range
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      // Adjust range if we're near the start or end
      if (currentPage <= 3) {
        endPage = Math.min(totalPages - 1, 4);
      } else if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }
      
      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pageNumbers.push('ellipsis-start');
      }
      
      // Add visible page range
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      
      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pageNumbers.push('ellipsis-end');
      }
      
      // Always show last page if we have more than one page
      if (totalPages > 1) {
        pageNumbers.push(totalPages);
      }
    }
    
    return pageNumbers;
  };

  // Render a single task row for the virtualized list
  const renderRow = ({ index, key, style, parent }: any) => {
    const task = displayTasks[index];
    
    // Make sure task exists to prevent errors with virtualized list
    if (!task) return null;
    
    return (
      <CellMeasurer
        cache={cache.current}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({ registerChild }) => (
          <div 
            ref={registerChild as any}
            style={{
              ...style,
              padding: '8px',
              // Remove height constraint to allow TaskCard to define its own height
              height: 'auto',
            }}
          >
            <TaskCard key={task.id} task={task} />
          </div>
        )}
      </CellMeasurer>
    );
  };

  // Render a grid of tasks with regular pagination
  if (usePagination || !useVirtualization) {
    return (
      <div className="space-y-6">
        {/* Task Grid */}
        <div 
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          role="region"
          aria-label="Task list"
        >
          {displayTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        
        {/* Pagination Controls - only show if we have more than one page */}
        {usePagination && totalPages > 1 && (
          <Pagination className="mt-8" aria-label="Task list pagination">
            <PaginationContent>
              {/* Previous Page Button */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 h-9 px-4"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Go to previous page"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </Button>
              </PaginationItem>
              
              {/* Page Numbers */}
              {getPageNumbers().map((pageNum, index) => (
                <PaginationItem key={`page-${pageNum}-${index}`}>
                  {pageNum === 'ellipsis-start' || pageNum === 'ellipsis-end' ? (
                    <PaginationEllipsis aria-hidden="true" />
                  ) : (
                    <PaginationLink 
                      isActive={currentPage === pageNum}
                      onClick={() => handlePageChange(pageNum as number)}
                      aria-label={`Page ${pageNum}${currentPage === pageNum ? ', current page' : ''}`}
                      aria-current={currentPage === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              {/* Next Page Button */}
              <PaginationItem>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1 h-9 px-4"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  aria-label="Go to next page"
                  title="Next page"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
        
        {/* Task Count Display */}
        {usePagination && (
          <div 
            className="text-sm text-muted-foreground text-center"
            aria-live="polite"
            role="status"
          >
            Showing {startIndex + 1}-{endIndex} of {totalItems} tasks
          </div>
        )}
      </div>
    );
  }

  // Render virtualized list for large data sets
  return (
    <div className="space-y-6">
      <div 
        className="virtualized-list-container" 
        style={{ width: '100%', minHeight: '300px' }}
        role="region" 
        aria-label="Virtualized task list"
      >
        <WindowScroller>
          {({ height, isScrolling, scrollTop, onChildScroll }) => (
            <AutoSizer disableHeight>
              {({ width }) => (
                <List
                  ref={listRef}
                  autoHeight
                  height={height || 800}
                  isScrolling={isScrolling}
                  scrollTop={scrollTop}
                  width={width}
                  rowCount={displayTasks.length}
                  rowHeight={cache.current.rowHeight}
                  rowRenderer={renderRow}
                  overscanRowCount={5} // Increased to preload more items for smoother scrolling
                  deferredMeasurementCache={cache.current}
                  onScroll={onChildScroll}
                  style={{ outline: 'none' }}
                  className="virtualized-task-grid"
                  aria-label="Scrollable list of tasks"
                  tabIndex={0}
                />
              )}
            </AutoSizer>
          )}
        </WindowScroller>
      </div>
      
      {/* Task Count Display */}
      <div 
        className="text-sm text-muted-foreground text-center"
        aria-live="polite"
        role="status"
      >
        Showing all {totalItems} tasks with virtual scrolling
        {isLoading && (
          <span className="ml-2 inline-flex items-center">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />
            <span aria-live="assertive">Loading tasks...</span>
          </span>
        )}
      </div>
    </div>
  );
}
