'use client';

import {useState, useEffect, useCallback} from 'react';
import {Card, CardContent, CardHeader} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Calendar} from "@/components/ui/calendar"
import {cn} from "@/lib/utils"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {format, differenceInDays, isPast} from "date-fns"
import {es} from 'date-fns/locale';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from '@/components/ui/alert-dialog';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {Check, Clock, Settings, Trash2} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useToast} from "@/hooks/use-toast"
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
} from "firebase/firestore";
import {db} from "@/lib/firebase";

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: string;
}

export default function Home() {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [fromColumnToDelete, setFromColumnToDelete] = useState<string | null>(null);
  const [formattedDate, setFormattedDate] = useState('Escoge una fecha');
  const {toast} = useToast()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showDateAlert, setShowDateAlert] = useState(false);
  const [showDuplicateTaskAlert, setShowDuplicateTaskAlert] = useState(false);

  const tasksCollection = collection(db, "tasks");

  useEffect(() => {
    if (dueDate instanceof Date) {
      setFormattedDate(format(dueDate, "PPP", {locale: es}));
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);

  useEffect(() => {
    const unsubscribe = onSnapshot(tasksCollection, (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const dueDate = data.dueDate ? new Date(data.dueDate) : undefined;
        return { id: doc.id, ...data, dueDate, status: data.status } as Task;
      });

      // Separar las tareas en las diferentes listas
      const pending = tasks.filter(task => task.status === 'Pendiente');
      const inProgress = tasks.filter(task => task.status === 'En Progreso');
      const completed = tasks.filter(task => task.status === 'Completada');

      setPendingTasks(pending);
      setInProgressTasks(inProgress);
      setCompletedTasks(completed);
    });

    return () => unsubscribe(); // Cleanup function
  }, []);


  const handleDateChange = (date: Date | undefined) => {
    setDueDate(date);
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

    const taskExists = [...pendingTasks, ...inProgressTasks, ...completedTasks].some(
      (task) => task.title === newTaskTitle
    );

    if (taskExists) {
      setShowDuplicateTaskAlert(true);
      return;
    }

    try {
      await addDoc(tasksCollection, {
        title: newTaskTitle,
        description: newTaskDescription,
        dueDate: dueDate.toISOString(),
        status: 'Pendiente', // Todas las nuevas tareas se agregan como "Pendiente"
      });

      setNewTaskTitle('');
      setNewTaskDescription('');
      setDueDate(undefined);
      setFormattedDate('Escoge una fecha');
      toast({
        title: "Tarea agregada!",
        description: "Tarea agregada a Pendiente.",
      });
    } catch (error) {
      console.error("Error al agregar la tarea:", error);
      toast({
        title: "Error!",
        description: "Error al agregar la tarea.",
      });
    }
  };

  const moveTask = async (taskId: string, from: string, to: string) => {
    let taskToMove: Task | undefined;
    let updatedPendingTasks = [...pendingTasks];
    let updatedInProgressTasks = [...inProgressTasks];
    let updatedCompletedTasks = [...completedTasks];

    // Función para remover la tarea de su lista actual
    const removeTask = (tasks: Task[], setTasks: React.Dispatch<React.SetStateAction<Task[]>>) => {
      const taskIndex = tasks.findIndex(task => task.id === taskId);
      if (taskIndex > -1) {
        taskToMove = tasks.splice(taskIndex, 1)[0];
        setTasks([...tasks]);
      }
    };

    // Remover la tarea de la lista 'from'
    if (from === 'Pendiente') {
      removeTask(updatedPendingTasks, setPendingTasks);
    } else if (from === 'En Progreso') {
      removeTask(updatedInProgressTasks, setInProgressTasks);
    } else if (from === 'Completada') {
      removeTask(updatedCompletedTasks, setCompletedTasks);
    }

    try {
      // Actualiza el estado de la tarea en Firestore
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, {
        status: to,
      });

      // Agregar la tarea a la nueva lista 'to'
      if (taskToMove) {
        taskToMove.status = to;
        if (to === 'Pendiente') {
          setPendingTasks([taskToMove, ...updatedPendingTasks]);
        } else if (to === 'En Progreso') {
          setInProgressTasks([taskToMove, ...updatedInProgressTasks]);
        } else if (to === 'Completada') {
          setCompletedTasks([taskToMove, ...updatedCompletedTasks]);
        }
      }

      setSelectedTask(null);
      toast({
        title: "Tarea movida!",
        description: `Tarea movida de ${from} a ${to}.`,
      });
    } catch (error) {
      console.error("Error al mover la tarea:", error);
      toast({
        title: "Error!",
        description: "Error al mover la tarea.",
      });
    }
  };

  const confirmDeleteTask = (taskId: string, from: string) => {
    setTaskToDelete(taskId);
    setFromColumnToDelete(from);
    setOpen(true);
  };

  const deleteTask = async () => {
    if (!taskToDelete || !fromColumnToDelete) return;

    const taskId = taskToDelete;
    const fromColumn = fromColumnToDelete;

    // Optimistically update the UI
    let taskToRemove: Task | undefined;
    let updatedTasks: Task[] = [];

    // Immediately update the state based on which column the task is being deleted from
    switch (fromColumn) {
      case 'Pendiente':
        taskToRemove = pendingTasks.find(task => task.id === taskId);
        updatedTasks = pendingTasks.filter(task => task.id !== taskId);
        setPendingTasks(updatedTasks);
        break;
      case 'En Progreso':
        taskToRemove = inProgressTasks.find(task => task.id === taskId);
        updatedTasks = inProgressTasks.filter(task => task.id !== taskId);
        setInProgressTasks(updatedTasks);
        break;
      case 'Completada':
        taskToRemove = completedTasks.find(task => task.id === taskId);
        updatedTasks = completedTasks.filter(task => task.id !== taskId);
        setCompletedTasks(updatedTasks);
        break;
      default:
        console.error("Columna inválida:", fromColumn);
        return;
    }

    setOpen(false);
    setTaskToDelete(null);
    setFromColumnToDelete(null);
    setSelectedTask(null);

    try {
      // Elimina la tarea de Firestore
      const taskDocRef = doc(db, "tasks", taskId);
      await deleteDoc(taskDocRef);

      toast({
        title: "Tarea eliminada!",
        description: "Tarea eliminada permanentemente.",
      });
    } catch (error) {
      console.error("Error al eliminar la tarea:", error);
      toast({
        title: "Error!",
        description: "Error al eliminar la tarea.",
      });

      // If there's an error, revert the UI update by adding the task back to its original column
      if (taskToRemove) {
        switch (fromColumn) {
          case 'Pendiente':
            setPendingTasks([...pendingTasks, taskToRemove]);
            break;
          case 'En Progreso':
            setInProgressTasks([...inProgressTasks, taskToRemove]);
            break;
          case 'Completada':
            setCompletedTasks([...completedTasks, taskToRemove]);
            break;
        }
      }
    }
  };


  const handleTaskClick = (task: Task, columnId: string) => {
    setSelectedTask(task);
    setSelectedColumn(columnId);
  };


  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4">
        <h1 className="text-3xl font-bold text-center mb-8">Tablero Kanban de TaskFlow</h1>

        <div className="flex flex-col gap-4">
          <div className="mb-2">
            <label htmlFor="newTaskTitle" className="block text-sm font-medium text-gray-700">
              Título de la tarea:
            </label>
            <Input
              type="text"
              id="newTaskTitle"
              placeholder="Ingresa el título de la tarea"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="mt-1 shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>

          <div className="mb-2">
            <label htmlFor="newTaskDescription" className="block text-sm font-medium text-gray-700">
              Descripción de la tarea:
            </label>
            <Textarea
              id="newTaskDescription"
              placeholder="Ingresa la descripción de la tarea"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="mt-1 shadow-sm focus:ring-teal-500 focus:border-teal-500 block w-full sm:text-sm border-gray-300 rounded-md"
            />
          </div>

          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  {formattedDate}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="bottom">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={handleDateChange}
                  initialFocus
                  fromMonth={new Date()}
                  defaultMonth={new Date()}
                />
              </PopoverContent>
            </Popover>

            <Button onClick={handleAddTask} className="bg-teal-500 text-white rounded px-4 py-2 hover:bg-teal-700">
              Añadir Tarea
            </Button>

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

            <AlertDialog open={showDuplicateTaskAlert} onOpenChange={setShowDuplicateTaskAlert}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tarea Duplicada</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ya existe una tarea con este título. Por favor, elige un título diferente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setShowDuplicateTaskAlert(false)}>
                    Ok
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <KanbanColumn
            title="Pendiente"
            tasks={pendingTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Pendiente"
            icon={<Clock className="h-4 w-4"/>}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            dropdownTitle="Tareas Pendientes"
            tooltipText="Tareas por hacer"
          />
          <KanbanColumn
            title="En Progreso"
            tasks={inProgressTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="En Progreso"
            icon={<Settings className="h-4 w-4"/>}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            dropdownTitle="Tareas En Progreso"
            tooltipText="Tareas en ejecución"
          />
          <KanbanColumn
            title="Completada"
            tasks={completedTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Completada"
            icon={<Check className="h-4 w-4"/>}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            dropdownTitle="Tareas Completadas"
            tooltipText="Tareas finalizadas"
          />
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará la tarea permanentemente.
                ¿Estás seguro de que quieres continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setOpen(false)
                setTaskToDelete(null)
                setFromColumnToDelete(null)
              }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteTask}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TooltipProvider>
  );
}

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
                          dropdownTitle,
                          tooltipText
                        }: KanbanColumnProps) {
  const getColumnBackgroundColor = () => {
    switch (title) {
      case "Pendiente":
        return "bg-gray-50";
      case "En Progreso":
        return "bg-blue-50";
      case "Completada":
        return "bg-green-50";
      default:
        return "bg-gray-100";
    }
  };

  let displayTitle = '';
  switch (title) {
    case "Pendiente":
      displayTitle = `Tareas Pendientes`;
      break;
    case "En Progreso":
      displayTitle = `Tareas En Progreso`;
      break;
    case "Completada":
      displayTitle = `Tareas Completadas`;
      break;
    default:
      displayTitle = title;
  }

  const handleAccordionClick = () => {
    if (selectedColumn === columnId) {
      setSelectedTask(null);
      return;
    }
    if (selectedTask) {
      setSelectedTask(null);
    }
  };

  return (
    <Card className={`w-80 rounded-md shadow-sm ${getColumnBackgroundColor()} hover:shadow-lg transition-shadow duration-300`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <Accordion type="single" collapsible onValueChange={handleAccordionClick}>
            <AccordionItem value={columnId}>
              <AccordionTrigger className="text-md font-medium flex items-center gap-2 hover:underline">
                {tasks.length}  {displayTitle}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {icon}
                    </TooltipTrigger>
                    <TooltipContent>
                      {tooltipText}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </AccordionTrigger>
              <AccordionContent>
                {tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Agrega tareas a esta sección.
                  </div>
                ) : (
                  tasks.map((task, index) => (
                    <div key={task.id} className="mb-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start hover:bg-teal-50"
                        onClick={() => onTaskClick(task, columnId)}
                      >
                        {index + 1}. {task.title}
                      </Button>
                    </div>
                  ))
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {selectedTask && selectedColumn === columnId && (
          <TaskCard
            task={selectedTask}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            from={columnId}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface TaskCardProps {
  task: Task;
  moveTask: (taskId: string, from: string, to: string) => void;
  confirmDeleteTask: (taskId: string, from: string) => void;
  from: string;
}

function TaskCard({task, moveTask, confirmDeleteTask, from}: TaskCardProps) {
  const isCloseToDueDate = task.dueDate ? differenceInDays(task.dueDate, new Date()) <= 3 : false;
  const isOverdue = task.dueDate ? isPast(task.dueDate) : false;
  const dueDateClassName = (isCloseToDueDate || isOverdue) ? 'text-red-500' : '';

  return (
    <Card className="bg-white rounded-md shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="flex flex-col">
        <div className="text-xs">
          <strong>Título:</strong> {task.title}
        </div>
        <div className="text-xs">
          <strong>Descripción:</strong> {task.description}
        </div>
        {task.dueDate && (
          <span className={cn("text-sm", dueDateClassName)}>
            <strong>Fecha:</strong> {task.dueDate ? format(task.dueDate, "PPP", {locale: es}) : 'Sin fecha'}
          </span>
        )}
      </CardContent>
      <CardContent>
        <div className="flex justify-around mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'Pendiente')}
                  className={cn(from === 'Pendiente' ? 'hidden' : 'bg-blue-500 hover:bg-blue-700 text-white')}
                  disabled={from === 'Pendiente'}
                >
                  <Clock className="h-4 w-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Mover a Pendiente
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'En Progreso')}
                  className={cn(from === 'En Progreso' ? 'hidden' : 'bg-yellow-500 hover:bg-yellow-700 text-white')}
                  disabled={from === 'En Progreso'}
                >
                  <Settings className="h-4 w-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Mover a En Progreso
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'Completada')}
                  className={cn(from === 'Completada' ? 'hidden' : 'bg-green-500 hover:bg-green-700 text-white')}
                  disabled={from === 'Completada'}
                >
                  <Check className="h-4 w-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Mover a Completada
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => confirmDeleteTask(task.id, from)}
                  className="bg-red-500 hover:bg-red-700 text-white"
                >
                  <Trash2 className="h-4 w-4"/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Eliminar Tarea
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
