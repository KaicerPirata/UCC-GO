'use client';

import {useState, useEffect} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {suggestDueDate} from '@/ai/flows/suggest-due-date';
import {Calendar} from "@/components/ui/calendar"
import {cn} from "@/lib/utils"
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover"
import {format} from "date-fns"
import {es} from 'date-fns/locale';
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger} from '@/components/ui/alert-dialog';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {Check, ChevronLeft, ChevronRight, Loader2, Trash2, Clock, Settings} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function Home() {
  const [pendingTasks, setPendingTasks] = useState<string[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');
  const [suggestedDueDate, setSuggestedDueDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [fromColumnToDelete, setFromColumnToDelete] = useState<string | null>(null);
  const [formattedDate, setFormattedDate] = useState('Escoge una fecha');

  useEffect(() => {
    if (dueDate instanceof Date && !isNaN(dueDate.getTime())) {
      setFormattedDate(format(dueDate, "PPP", { locale: es }));
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);


  const handleDateChange = (date: Date | undefined) => {
    setDueDate(date);
  };

  const handleAddTask = async () => {
    if (newTaskDescription) {
      setPendingTasks([...pendingTasks, newTaskDescription]);
      setNewTaskDescription('');

      try {
        const aiSuggestion = await suggestDueDate({
          taskDescription: newTaskDescription,
        });
        setSuggestedDueDate(aiSuggestion.suggestedDueDate);
      } catch (error) {
        console.error('Error al obtener sugerencia:', error);
        setSuggestedDueDate('Error al obtener sugerencia');
      }
    }
  };

  const moveTask = (task: string, from: string, to: string) => {
    if (from === 'Pendiente') {
      setPendingTasks(pendingTasks.filter((t) => t !== task));
    } else if (from === 'En Progreso') {
      setInProgressTasks(inProgressTasks.filter((t) => t !== task));
    } else if (from === 'Completada') {
      setCompletedTasks(completedTasks.filter((t) => t !== task));
    }

    if (to === 'Pendiente') {
      setPendingTasks([...pendingTasks, task]);
    } else if (to === 'En Progreso') {
      setInProgressTasks([...inProgressTasks, task]);
    } else if (to === 'Completada') {
      setCompletedTasks([...completedTasks, task]);
    }
  };

  const confirmDeleteTask = (task: string, from: string) => {
    setTaskToDelete(task);
    setFromColumnToDelete(from);
    setOpen(true);
  };

  const deleteTask = () => {
    if (!taskToDelete || !fromColumnToDelete) return;

    if (fromColumnToDelete === 'Pendiente') {
      setPendingTasks(pendingTasks.filter((t) => t !== taskToDelete));
    } else if (fromColumnToDelete === 'En Progreso') {
      setInProgressTasks(inProgressTasks.filter((t) => t !== taskToDelete));
    } else if (fromColumnToDelete === 'Completada') {
      setCompletedTasks(completedTasks.filter((t) => t !== taskToDelete));
    }

    setOpen(false);
    setTaskToDelete(null);
    setFromColumnToDelete(null);
  };


  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4">
        <h1 className="text-2xl font-bold">Tablero Kanban de TaskFlow</h1>

        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Ingrese la descripción de la tarea"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="border rounded p-2 w-full"
          />
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

        {suggestedDueDate && <p>Fecha de Vencimiento Sugerida: {suggestedDueDate}</p>}

        <div className="flex flex-wrap gap-4">
          <KanbanColumn
            title="Pendiente"
            tasks={pendingTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Pendiente"
          />
          <KanbanColumn
            title="En Progreso"
            tasks={inProgressTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="En Progreso"
          />
          <KanbanColumn
            title="Completada"
            tasks={completedTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Completada"
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
  tasks: string[];
  moveTask: (task: string, from: string, to: string) => void;
  confirmDeleteTask: (task: string, from: string) => void;
  columnId: string;
}

function KanbanColumn({title, tasks, moveTask, confirmDeleteTask, columnId}: KanbanColumnProps) {
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

  return (
    <Card className={`w-80 rounded-md shadow-sm ${getColumnBackgroundColor()}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
  task: string;
  moveTask: (task: string, from: string, to: string) => void;
  confirmDeleteTask: (task: string, from: string) => void;
  from: string;
  taskNumber: number;
}

function TaskCard({task, moveTask, confirmDeleteTask, from, taskNumber}: TaskCardProps) {
  return (
    <Card className="bg-white rounded-md shadow-sm">
      <CardContent>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="p-2 w-full justify-start">
              {taskNumber}. {task}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>{task}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex justify-between mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => moveTask(task, from, 'Pendiente')}
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
                  onClick={() => moveTask(task, from, 'En Progreso')}
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
                  onClick={() => moveTask(task, from, 'Completada')}
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
                  onClick={() => confirmDeleteTask(task, from)}
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
