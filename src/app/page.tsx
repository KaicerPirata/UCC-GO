'use client';

import {useState, useEffect} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Calendar} from "@/components/ui/calendar"
import {cn} from "@/lib/utils"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {format, differenceInDays, isPast} from "date-fns"
import {es} from 'date-fns/locale';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from '@/components/ui/alert-dialog';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {Check, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, Clock, Settings} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";

interface Task {
  title: string;
  description: string;
  dueDate?: Date;
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

  useEffect(() => {
    if (dueDate instanceof Date) {
      setFormattedDate(format(dueDate, "PPP", { locale: es }));
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);


  const handleDateChange = (date: Date | undefined) => {
    setDueDate(date);
  };

  const handleAddTask = async () => {
    if (newTaskTitle && newTaskDescription) {
      setPendingTasks([...pendingTasks, { title: newTaskTitle, description: newTaskDescription, dueDate: dueDate}]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setDueDate(undefined);
      setFormattedDate('Escoge una fecha');
    }
  };

  const moveTask = (taskTitle: string, from: string, to: string) => {
    let taskToMove: Task | undefined;
    let taskList: Task[] = [];

    if (from === 'Pendiente') {
      taskList = pendingTasks;
      setPendingTasks(pendingTasks.filter(task => task.title !== taskTitle));
    } else if (from === 'En Progreso') {
      taskList = inProgressTasks;
      setInProgressTasks(inProgressTasks.filter(task => task.title !== taskTitle));
    } else if (from === 'Completada') {
      taskList = completedTasks;
      setCompletedTasks(completedTasks.filter(task => task.title !== taskTitle));
    }

    taskToMove = taskList.find(task => task.title === taskTitle);
  
    if (taskToMove) {
      if (to === 'Pendiente') {
        setPendingTasks([...pendingTasks, taskToMove]);
      } else if (to === 'En Progreso') {
        setInProgressTasks([...inProgressTasks, taskToMove]);
      } else if (to === 'Completada') {
        setCompletedTasks([...completedTasks, taskToMove]);
      }
    };
  };

  const confirmDeleteTask = (taskTitle: string, from: string) => {
    setTaskToDelete(taskTitle);
    setFromColumnToDelete(from);
    setOpen(true);
  };

  const deleteTask = () => {
    if (!taskToDelete || !fromColumnToDelete) return;

    let taskList: Task[] = [];

    if (fromColumnToDelete === 'Pendiente') {
      taskList = pendingTasks;
      setPendingTasks(pendingTasks.filter(task => task.title !== taskToDelete));
    } else if (fromColumnToDelete === 'En Progreso') {
      taskList = inProgressTasks;
      setInProgressTasks(inProgressTasks.filter(task => task.title !== taskToDelete));
    } else if (fromColumnToDelete === 'Completada') {
      taskList = completedTasks;
      setCompletedTasks(completedTasks.filter(task => task.title !== taskToDelete));
    }

    setOpen(false);
    setTaskToDelete(null);
    setFromColumnToDelete(null);
  };


  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4">
        <h1 className="text-2xl font-bold">Tablero Kanban de TaskFlow</h1>

        <div className="flex flex-col gap-2">
           <div>Título:</div>
          <Input
            type="text"
            placeholder="Ingrese el título de la tarea"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="border rounded p-2 w-full"
          />
           <div>Descripción:</div>
           <Textarea
            placeholder="Ingrese la descripción de la tarea"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="border rounded p-2 w-full"
          />

          <div className="flex items-center gap-2">
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

            <Button onClick={handleAddTask} className="bg-teal-500 text-white rounded px-4 py-2">
              Agregar Tarea
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <KanbanColumn
            title="Pendiente"
            tasks={pendingTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Pendiente"
            icon={<Clock className="h-4 w-4"/>}
          />
          <KanbanColumn
            title="En Progreso"
            tasks={inProgressTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="En Progreso"
            icon={<Settings className="h-4 w-4"/>}
          />
          <KanbanColumn
            title="Completada"
            tasks={completedTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Completada"
            icon={<Check className="h-4 w-4"/>}
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
  moveTask: (taskTitle: string, from: string, to: string) => void;
  confirmDeleteTask: (taskTitle: string, from: string) => void;
  columnId: string;
  icon: React.ReactNode;
}

function KanbanColumn({title, tasks, moveTask, confirmDeleteTask, columnId, icon}: KanbanColumnProps) {
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

  const getTooltipText = () => {
    switch (title) {
      case "Pendiente":
        return "Tareas por hacer";
      case "En Progreso":
        return "Tareas en ejecución";
      case "Completada":
        return "Tareas finalizadas";
      default:
        return "";
    }
  };

  return (
    <Card className={`w-80 rounded-md shadow-sm ${getColumnBackgroundColor()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          {title}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {icon}
              </TooltipTrigger>
              <TooltipContent>
                {getTooltipText()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {tasks.map((task, index) => (
          <TaskCard
            key={index}
            task={task}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            from={columnId}
            taskNumber={index + 1}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface TaskCardProps {
  task: Task;
  moveTask: (taskTitle: string, from: string, to: string) => void;
  confirmDeleteTask: (taskTitle: string, from: string) => void;
  from: string;
  taskNumber: number;
}

function TaskCard({task, moveTask, confirmDeleteTask, from, taskNumber}: TaskCardProps) {
  const isCloseToDueDate = task.dueDate ? differenceInDays(task.dueDate, new Date()) <= 3 : false;
  const isOverdue = task.dueDate ? isPast(task.dueDate) : false;
  const dueDateClassName = (isCloseToDueDate || isOverdue) ? 'text-red-500' : '';

  return (
    <Card className="bg-white rounded-md shadow-sm">
      <CardContent className="flex flex-col">
        <div className="text-xs">
          Título: {task.title}
        </div>
        <div className="text-xs">
          Descripción: {task.description}
        </div>
        {task.dueDate && (
          <span className={cn("text-sm", dueDateClassName)}>
            Fecha: {task.dueDate ? format(task.dueDate, "PPP", { locale: es }) : 'Sin fecha'}
          </span>
        )}
        
        
      </CardContent>
      <CardContent>
        <div className="flex justify-between mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => moveTask(task.title, from, 'Pendiente')}
                  icon={<Clock className="h-4 w-4"/>}
                />
              </TooltipTrigger>
              <TooltipContent>
                Mover a Pendiente
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => moveTask(task.title, from, 'En Progreso')}
                  icon={<Settings className="h-4 w-4"/>}
                />
              </TooltipTrigger>
              <TooltipContent>
                Mover a En Progreso
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => moveTask(task.title, from, 'Completada')}
                  icon={<Check className="h-4 w-4"/>}
                />
              </TooltipTrigger>
              <TooltipContent>
                Mover a Completada
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => confirmDeleteTask(task.title, from)}
                  icon={<Trash2 className="h-4 w-4"/>}
                />
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

interface IconButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
}

function IconButton({onClick, icon}: IconButtonProps) {
  return (
    <Button size="icon" variant="ghost" onClick={onClick}>
      {icon}
    </Button>
  );
}
