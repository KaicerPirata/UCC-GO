

'use client';

import type { User } from 'firebase/auth'; // Keep User type for potential future use
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Import Firestore instance only
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale'; // Import Spanish locale
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Settings, Trash2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  Timestamp,
} from 'firebase/firestore';

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: string;
}

function App() {
  // No auth state or effects needed
  return <MainContent />;
}

function MainContent() {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false); // State for delete confirmation dialog
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [fromColumnToDelete, setFromColumnToDelete] = useState<string | null>(
    null
  );
  const [formattedDate, setFormattedDate] = useState('Escoge una fecha');
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showDateAlert, setShowDateAlert] = useState(false);
  const [showDuplicateTaskAlert, setShowDuplicateTaskAlert] = useState(false);

  const tasksCollection = collection(db, 'tasks');

  useEffect(() => {
    if (dueDate instanceof Date) {
      try {
        // Format date using Spanish locale
        setFormattedDate(format(dueDate, 'PPP', { locale: es }));
      } catch (error) {
        console.error('Error formatting date:', error);
        setFormattedDate('Fecha inválida'); // Handle potential errors
      }
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);

  // Effect to load tasks from Firestore on component mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksQuery = query(tasksCollection);
        const snapshot = await getDocs(tasksQuery); // Use getDocs for a single load

        const tasks: Task[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          let taskDueDate: Date | undefined;
          if (data.dueDate instanceof Timestamp) {
            taskDueDate = data.dueDate.toDate();
          } else if (typeof data.dueDate === 'string') {
            try {
              taskDueDate = new Date(data.dueDate);
              if (isNaN(taskDueDate.getTime())) {
                console.warn(
                  `Invalid date string found for task ${doc.id}: ${data.dueDate}`
                );
                taskDueDate = undefined;
              }
            } catch (e) {
              console.error(
                `Error parsing date string for task ${doc.id}: ${data.dueDate}`,
                e
              );
              taskDueDate = undefined;
            }
          } else {
            taskDueDate = undefined;
          }

          const status =
            typeof data.status === 'string' ? data.status : 'Pendiente';
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            status: status,
            dueDate: taskDueDate,
          } as Task;
        });

        const pending = tasks.filter((task) => task.status === 'Pendiente');
        const inProgress = tasks.filter(
          (task) => task.status === 'En Progreso'
        );
        const completed = tasks.filter((task) => task.status === 'Completada');

        setPendingTasks(pending);
        setInProgressTasks(inProgress);
        setCompletedTasks(completed);
      } catch (error) {
        console.error('Error al cargar las tareas:', error);
        toast({
          title: 'Error de conexión',
          description: 'No se pudieron cargar las tareas.',
          variant: 'destructive',
        });
      }
    };

    fetchTasks();
  }, [toast]); // Removed tasksCollection dependency as it's constant

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set time to the beginning of the day for comparison
        if (date >= today) {
            setDueDate(date);
        } else {
            // Optionally show an alert or message that past dates are not allowed
            toast({
                title: 'Fecha inválida',
                description: 'No puedes seleccionar una fecha pasada.',
                variant: 'destructive',
            });
            setDueDate(undefined); // Reset or keep the previous valid date
        }
    } else {
        setDueDate(undefined);
    }
  };


  const handleAddTask = async () => {
    if (!newTaskTitle || !newTaskDescription) {
      setShowAlert(true);
      return;
    }

    if (!dueDate) {
      setShowDateAlert(true);
      return;
    }

    // Verify if a task with the same title already exists
    const allTasks = [...pendingTasks, ...inProgressTasks, ...completedTasks];
    const taskExists = allTasks.some(
      (task) => task.title.toLowerCase() === newTaskTitle.toLowerCase()
    );

    if (taskExists) {
      setShowDuplicateTaskAlert(true);
      return;
    }

    const newTaskData = {
      title: newTaskTitle,
      description: newTaskDescription,
      dueDate: dueDate ? dueDate.toISOString() : null, // Save as ISO string or null in Firestore
      status: 'Pendiente',
    };

    try {
      // Add to Firestore first
      const docRef = await addDoc(tasksCollection, newTaskData);

      // Create the new task object for local state using the Firestore doc ID
      const newTask: Task = {
        ...newTaskData,
        id: docRef.id,
        dueDate: dueDate, // Use the Date object for local state consistency
      };

      // Use functional update for setPendingTasks
      setPendingTasks((prevPendingTasks) => [newTask, ...prevPendingTasks]);

      // Reset form fields
      setNewTaskTitle('');
      setNewTaskDescription('');
      setDueDate(undefined);
      setFormattedDate('Escoge una fecha');

      toast({
        title: '¡Tarea agregada!',
        description: 'Tarea agregada a Pendiente.',
      });
    } catch (error) {
      console.error('Error al agregar la tarea:', error);
      toast({
        title: '¡Error!',
        description: 'Error al agregar la tarea.',
        variant: 'destructive',
      });
    }
  };

  const moveTask = async (taskId: string, from: string, to: string) => {
    let taskToMove: Task | undefined;
    let updatedPendingTasks = [...pendingTasks];
    let updatedInProgressTasks = [...inProgressTasks];
    let updatedCompletedTasks = [...completedTasks];

    const removeTask = (tasks: Task[]): [Task | undefined, Task[]] => {
      const taskIndex = tasks.findIndex((task) => task.id === taskId);
      if (taskIndex > -1) {
        const foundTask = tasks[taskIndex];
        const newTasks = [...tasks];
        newTasks.splice(taskIndex, 1);
        return [foundTask, newTasks];
      }
      return [undefined, tasks];
    };

    // Remover la tarea de la lista 'from' y obtener la lista actualizada
    if (from === 'Pendiente') {
      [taskToMove, updatedPendingTasks] = removeTask(pendingTasks);
    } else if (from === 'En Progreso') {
      [taskToMove, updatedInProgressTasks] = removeTask(inProgressTasks);
    } else if (from === 'Completada') {
      [taskToMove, updatedCompletedTasks] = removeTask(completedTasks);
    }

    if (!taskToMove) {
      console.error('No se encontró la tarea a mover.');
      return;
    }

    // Crear la tarea movida con el nuevo estado
    const movedTask = { ...taskToMove, status: to };

    // Actualizar los estados locales correspondientes
    if (to === 'Pendiente') {
      setPendingTasks([movedTask, ...updatedPendingTasks]);
      if (from === 'En Progreso') setInProgressTasks(updatedInProgressTasks);
      if (from === 'Completada') setCompletedTasks(updatedCompletedTasks);
    } else if (to === 'En Progreso') {
      setInProgressTasks([movedTask, ...updatedInProgressTasks]);
      if (from === 'Pendiente') setPendingTasks(updatedPendingTasks);
      if (from === 'Completada') setCompletedTasks(updatedCompletedTasks);
    } else if (to === 'Completada') {
      setCompletedTasks([movedTask, ...updatedCompletedTasks]);
      if (from === 'Pendiente') setPendingTasks(updatedPendingTasks);
      if (from === 'En Progreso') setInProgressTasks(updatedInProgressTasks);
    }

    setSelectedTask(null); // Deseleccionar la tarea después de moverla

    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        status: to,
      });

      toast({
        title: '¡Tarea movida!',
        description: `Tarea movida de ${from} a ${to}.`,
      });
    } catch (error) {
      console.error('Error al mover la tarea:', error);
      toast({
        title: '¡Error!',
        description: 'Error al mover la tarea.',
        variant: 'destructive',
      });

      // Revertir el cambio en el estado local si Firestore falla
      // This part requires careful state management to avoid race conditions
      // For simplicity, we might re-fetch tasks on error, or implement more robust rollback
      // For now, just logging the error and showing toast
    }
  };

  const confirmDeleteTask = (taskId: string, from: string) => {
    setTaskToDelete(taskId);
    setFromColumnToDelete(from);
    setOpen(true); // Open the confirmation dialog
  };

  const deleteTask = async () => {
    if (!taskToDelete || !fromColumnToDelete) return;

    const taskId = taskToDelete;
    const fromColumn = fromColumnToDelete;

    // Optimistically update the UI
    let originalTasks: Task[] | undefined;
    let setTasks: React.Dispatch<React.SetStateAction<Task[]>> | undefined;

    switch (fromColumn) {
      case 'Pendiente':
        originalTasks = [...pendingTasks];
        setTasks = setPendingTasks;
        setPendingTasks((prev) => prev.filter((task) => task.id !== taskId));
        break;
      case 'En Progreso':
        originalTasks = [...inProgressTasks];
        setTasks = setInProgressTasks;
        setInProgressTasks((prev) =>
          prev.filter((task) => task.id !== taskId)
        );
        break;
      case 'Completada':
        originalTasks = [...completedTasks];
        setTasks = setCompletedTasks;
        setCompletedTasks((prev) => prev.filter((task) => task.id !== taskId));
        break;
      default:
        console.error('Columna inválida:', fromColumn);
        setOpen(false);
        setTaskToDelete(null);
        setFromColumnToDelete(null);
        return;
    }

    setOpen(false); // Close the dialog
    setTaskToDelete(null);
    setFromColumnToDelete(null);
    if (selectedTask?.id === taskId) {
      setSelectedTask(null); // Deselect if the deleted task was selected
      setSelectedColumn(null);
    }

    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskDocRef);

      toast({
        title: '¡Tarea eliminada!',
        description: 'Tarea eliminada permanentemente.',
      });
    } catch (error) {
      console.error('Error al eliminar la tarea:', error);
      toast({
        title: '¡Error!',
        description: 'Error al eliminar la tarea.',
        variant: 'destructive',
      });
      // Revert the UI update if deletion fails
      if (originalTasks && setTasks) {
        setTasks(originalTasks);
      }
    }
  };

  const handleTaskClick = (task: Task, columnId: string) => {
     if (selectedTask?.id === task.id && selectedColumn === columnId) {
      setSelectedTask(null); // Deselect if clicking the same task again
      setSelectedColumn(null);
    } else {
      setSelectedTask(task);
      setSelectedColumn(columnId);
    }
  };

  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4 bg-background text-foreground">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-primary font-sans text-white">
             CheckItOut
          </h1>
          <p className="text-lg text-muted-foreground">Tablero Kanban</p>
        </div>

        {/* Formulario para añadir tareas */}
        <Card className="mb-8 p-6 shadow-lg bg-card border border-border rounded-lg">
          <CardHeader>
            <h2 className="text-2xl font-semibold text-card-foreground">Añadir Nueva Tarea</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="mb-2">
              <label
                htmlFor="newTaskTitle"
                className="block text-sm font-medium text-card-foreground mb-1">
                Título de la tarea:
              </label>
              <Input
                type="text"
                id="newTaskTitle"
                placeholder="Ingresa el título de la tarea"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md bg-background text-foreground"
              />
            </div>
            <div className="mb-2">
              <label
                htmlFor="newTaskDescription"
                className="block text-sm font-medium text-card-foreground mb-1">
                Descripción de la tarea:
              </label>
              <Textarea
                id="newTaskDescription"
                placeholder="Ingresa la descripción de la tarea"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md bg-background text-foreground"
              />
            </div>
            <div className="flex items-center gap-4 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-[240px] justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground',
                      'bg-card border-input hover:bg-accent hover:text-accent-foreground'
                    )}>
                    {formattedDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-popover border-popover"
                  align="start"
                  side="bottom">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDateChange}
                    initialFocus
                    fromMonth={new Date()} // Permitir seleccionar fechas futuras
                    defaultMonth={new Date()}
                    className="bg-popover text-popover-foreground"
                    locale={es} // Pass the Spanish locale
                    classNames={{
                      day_selected:
                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                      day_today: 'bg-accent text-accent-foreground',
                    }}
                  />
                </PopoverContent>
              </Popover>
              <Button
                onClick={handleAddTask}
                className="bg-blue-500 text-white hover:bg-blue-600"> {/* Changed button color */}
                Añadir Tarea
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        <AlertDialog open={showDateAlert} onOpenChange={setShowDateAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Falta la Fecha de Vencimiento</AlertDialogTitle>
              <AlertDialogDescription>
                Por favor, selecciona una fecha de vencimiento para la tarea.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDateAlert(false)}>
                Ok
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Faltan Datos</AlertDialogTitle>
              <AlertDialogDescription>
                Por favor, completa el título y la descripción de la tarea.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAlert(false)}>
                Ok
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={showDuplicateTaskAlert}
          onOpenChange={setShowDuplicateTaskAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tarea Duplicada</AlertDialogTitle>
              <AlertDialogDescription>
                Ya existe una tarea con este título. Por favor, elige un título
                diferente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDuplicateTaskAlert(false)}>
                Ok
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Columnas Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <KanbanColumn
            title="Pendiente"
            tasks={pendingTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Pendiente"
            icon={<Clock className="h-8 w-8 text-yellow-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas Pendientes"
            tooltipText="Tareas por hacer"
          />
          <KanbanColumn
            title="En Progreso"
            tasks={inProgressTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="En Progreso"
            icon={<Settings className="h-8 w-8 text-blue-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas En Progreso"
            tooltipText="Tareas en ejecución"
          />
          <KanbanColumn
            title="Completada"
            tasks={completedTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Completada"
            icon={<Check className="h-8 w-8 text-green-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas Completadas"
            tooltipText="Tareas finalizadas"
          />
        </div>

        {/* Dialogo de confirmación de eliminación */}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará la tarea permanentemente. ¿Estás seguro de
                que quieres continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setOpen(false);
                  setTaskToDelete(null);
                  setFromColumnToDelete(null);
                }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={deleteTask}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TooltipProvider>
  );
}
export default App; // Export the main App component

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  moveTask: (taskId: string, from: string, to: string) => void;
  confirmDeleteTask: (taskId: string, from: string) => void;
  columnId: string;
  icon: React.ReactNode;
  onTaskClick: (task: Task, columnId: string) => void;
  selectedTask: Task | null;
  selectedColumn: string | null;
  setSelectedTask: (task: Task | null) => void;
  setSelectedColumn: (columnId: string | null) => void; // Added this prop
  dropdownTitle: string;
  tooltipText: string;
}

function KanbanColumn({
  title,
  tasks,
  moveTask,
  confirmDeleteTask,
  columnId,
  icon,
  onTaskClick,
  selectedTask,
  selectedColumn,
  setSelectedTask,
  setSelectedColumn, // Receive the prop
  dropdownTitle,
  tooltipText,
}: KanbanColumnProps) {
  const getColumnBackgroundColor = () => {
    switch (title) {
      case 'Pendiente':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100';
      case 'En Progreso':
        return 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100';
      case 'Completada':
        return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:border-green-700 dark:text-green-100';
      default:
        return 'bg-card border-border text-card-foreground';
    }
  };


  let displayTitle = '';
  switch (title) {
    case 'Pendiente':
      displayTitle = `Tareas Pendientes`;
      break;
    case 'En Progreso':
      displayTitle = `Tareas En Progreso`;
      break;
    case 'Completada':
      displayTitle = `Tareas Completadas`;
      break;
    default:
      displayTitle = title;
  }

  const handleAccordionClick = (value: string) => {
    // The accordion manages its own open/close state based on value.
    // We only need to potentially close the selected task if the accordion itself closes.
     if (!value && selectedColumn === columnId) { // If accordion closes and it was the selected one
       setSelectedTask(null);
       setSelectedColumn(null); // Now this function is defined
     }
     // If a different accordion opens, the selectedTask will be handled by onTaskClick
  };


  return (
    <Card
      className={`w-full rounded-lg shadow-lg ${getColumnBackgroundColor()} hover:shadow-xl transition-shadow duration-300 flex flex-col`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 flex-shrink-0">
        <Accordion
          type="single"
          collapsible
          className="w-full"
          onValueChange={handleAccordionClick}>
          <AccordionItem value={columnId} className="border-b-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AccordionTrigger className="text-lg font-semibold flex items-center justify-between w-full hover:no-underline py-2 px-2 rounded hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-2">
                      {icon}
                      <span>
                         {tasks.length} {displayTitle}
                      </span>
                    </div>
                  </AccordionTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltipText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AccordionContent className="pt-2 px-2">
              {tasks.length === 0 ? (
                <div className="text-sm italic py-4 text-center">
                  No hay tareas en esta sección.
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {tasks.map((task, index) => (
                    <div key={task.id} className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        className={`w-full justify-start hover:bg-muted text-left py-2 px-3 rounded transition-colors text-sm ${getColumnBackgroundColor().split(' ')[2]} ${selectedTask?.id === task.id && selectedColumn === columnId ? 'bg-muted font-semibold' : ''}`} // Use column's text color and highlight if selected
                        onClick={() => onTaskClick(task, columnId)}>
                         {index + 1}. {task.title}
                      </Button>
                      {/* Conditionally render TaskCard directly below the button if selected */}
                      {selectedTask?.id === task.id && selectedColumn === columnId && (
                         <div className="pl-4 pr-1 pb-2"> {/* Indent the card slightly */}
                             <TaskCard
                                task={selectedTask}
                                moveTask={moveTask}
                                confirmDeleteTask={confirmDeleteTask}
                                from={columnId}
                              />
                         </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardHeader>
       {/* Removed the CardContent that previously held the selected TaskCard */}
    </Card>
  );
}


interface TaskCardProps {
  task: Task;
  moveTask: (taskId: string, from: string, to: string) => void;
  confirmDeleteTask: (taskId: string, from: string) => void;
  from: string;
}

function TaskCard({ task, moveTask, confirmDeleteTask, from }: TaskCardProps) {
  const isCloseToDueDate = task.dueDate
    ? differenceInDays(task.dueDate, new Date()) <= 3 && !isPast(task.dueDate)
    : false;
  const isOverdue = task.dueDate ? isPast(task.dueDate) : false;

  let dueDateClassName = 'text-muted-foreground';
  if (isOverdue) {
    dueDateClassName = 'text-destructive font-semibold';
  } else if (isCloseToDueDate) {
    dueDateClassName = 'text-yellow-500';
  }

  return (
     <Card className="bg-card rounded-lg shadow-md border border-border p-4 mt-1 text-card-foreground"> {/* Reduced top margin */}
      <CardContent className="flex flex-col gap-2 pb-2"> {/* Reduced bottom padding */}
        <div className="text-sm">
          <strong className="text-foreground/80">Título:</strong> {task.title}
        </div>
        <div className="text-sm">
          <strong className="text-foreground/80">Descripción:</strong>{' '}
          {task.description}
        </div>
        {task.dueDate && (
          <div className="text-sm">
            <strong className="text-foreground/80">Fecha:</strong>{' '}
            <span className={dueDateClassName}>
              {task.dueDate instanceof Date
                ? format(task.dueDate, 'PPP', { locale: es }) // Format date using Spanish locale
                : 'Fecha inválida'}
              {isOverdue && ' (Vencida)'}
              {isCloseToDueDate && ' (Próxima a vencer)'}
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-3 pb-0 px-0"> {/* Adjusted padding for footer */}
        <div className="flex justify-around w-full border-t border-border pt-3">
          <TooltipProvider>
             {from !== 'Pendiente' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveTask(task.id, from, 'Pendiente')}
                    className="hover:bg-yellow-500/20 text-yellow-500"
                   >
                    <Clock className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover a Pendiente</TooltipContent>
              </Tooltip>
             )}
             {from !== 'En Progreso' && (
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveTask(task.id, from, 'En Progreso')}
                     className="hover:bg-blue-500/20 text-blue-500"
                   >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover a En Progreso</TooltipContent>
              </Tooltip>
             )}
             {from !== 'Completada' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => moveTask(task.id, from, 'Completada')}
                    className="hover:bg-green-500/20 text-green-500"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mover a Completada</TooltipContent>
              </Tooltip>
             )}
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => confirmDeleteTask(task.id, from)}
                  className="hover:bg-destructive/20 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar Tarea</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}




    

