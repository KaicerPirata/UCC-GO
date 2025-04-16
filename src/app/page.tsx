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
import {Check, Clock, Settings, Trash2} from "lucide-react";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {useToast} from "@/hooks/use-toast"
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion";

interface Task {
  id: string;
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
  const {toast} = useToast()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showDateAlert, setShowDateAlert] = useState(false);


  useEffect(() => {
    if (dueDate instanceof Date) {
      setFormattedDate(format(dueDate, "PPP", {locale: es}));
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);


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

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      description: newTaskDescription,
      dueDate: dueDate
    };
    setPendingTasks([...pendingTasks, newTask]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setDueDate(undefined);
    setFormattedDate('Escoge una fecha');
    toast({
      title: "Tarea agregada!",
      description: "Tarea agregada a Pendiente.",
    })

  };

  const moveTask = (taskId: string, from: string, to: string) => {
    let taskToMove: Task | undefined;

    // Helper function to remove a task from a list and return the task and the updated list
    const removeTask = (tasks: Task[], setTask: (tasks: Task[]) => void): [Task | undefined, Task[]] => {
      const taskIndex = tasks.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        const task = tasks[taskIndex];
        const newTasks = [...tasks.slice(0, taskIndex), ...tasks.slice(taskIndex + 1)];
        setTask(newTasks);
        return [task, newTasks];
      }
      return [undefined, tasks];
    };

    // Remove the task from its current column
    let updatedPendingTasks: Task[];
    let updatedInProgressTasks: Task[];
    let updatedCompletedTasks: Task[];

    if (from === 'Pendiente') {
      [taskToMove, updatedPendingTasks] = removeTask(pendingTasks, setPendingTasks);
    } else if (from === 'En Progreso') {
      [taskToMove, updatedInProgressTasks] = removeTask(inProgressTasks, setInProgressTasks);
    } else if (from === 'Completada') {
      [taskToMove, updatedCompletedTasks] = removeTask(completedTasks, setCompletedTasks);
    } else {
      return;
    }

    if (taskToMove) {
      // Add the task to the new column
      const addTask = (tasks: Task[], setTask: (tasks: Task[]) => void) => {
        setTask([...tasks, taskToMove]);
      };

      if (to === 'Pendiente') {
        addTask(pendingTasks, setPendingTasks);
      } else if (to === 'En Progreso') {
        addTask(inProgressTasks, setInProgressTasks);
      } else if (to === 'Completada') {
        addTask(completedTasks, setCompletedTasks);
      }
    }

    setSelectedTask(null)
    toast({
      title: "Tarea movida!",
      description: `Tarea movida de ${from} a ${to}.`,
    })
  };

  const confirmDeleteTask = (taskId: string, from: string) => {
    setTaskToDelete(taskId);
    setFromColumnToDelete(from);
    setOpen(true);
  };

  const deleteTask = () => {
    if (!taskToDelete || !fromColumnToDelete) return;

    let taskList: Task[] = [];
    let setTask: (tasks: Task[]) => void;

    if (fromColumnToDelete === 'Pendiente') {
      taskList = pendingTasks;
      setTask = setPendingTasks;
    } else if (fromColumnToDelete === 'En Progreso') {
      taskList = inProgressTasks;
      setTask = setInProgressTasks;
    } else if (fromColumnToDelete === 'Completada') {
      taskList = completedTasks;
      setTask = setCompletedTasks;
    } else {
      return; // Invalid column
    }

    const updatedTaskList = taskList.filter(task => task.id !== taskToDelete);
    setTask(updatedTaskList);

    setOpen(false);
    setTaskToDelete(null);
    setFromColumnToDelete(null);

    setSelectedTask(null)
    toast({
      title: "Tarea eliminada!",
      description: "Tarea eliminada permanentemente.",
    })
  };

  const handleTaskClick = (task: Task, columnId: string) => {
    setSelectedTask(task);
    setSelectedColumn(columnId);
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
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            dropdownTitle="Tarea Pendiente"
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
            dropdownTitle="Tarea En Progreso"
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
            dropdownTitle="Tarea Completada"
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
                          dropdownTitle
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

  const handleAccordionClick = () => {
    // If the column is already selected, deselect it
    if (selectedColumn === columnId) {
      setSelectedTask(null);
      return;
    }
    // If a task is selected in a different column, clear it
    if (selectedTask) {
      setSelectedTask(null);
    }
  };

  return (
    <Card className={`w-80 rounded-md shadow-sm ${getColumnBackgroundColor()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-md font-medium flex items-center gap-2">
          <Accordion type="single" collapsible onValueChange={handleAccordionClick}>
            <AccordionItem value={columnId}>
              <AccordionTrigger>
                {dropdownTitle}
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
              </AccordionTrigger>
              <AccordionContent>
                {tasks.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Agrega tareas a esta sección.
                  </div>
                ) : (
                  tasks.map((task, index) => {
                    const taskNumber = index + 1;
                    return (
                      <div key={task.id} className="mb-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => onTaskClick(task, columnId)}
                        >
                          {taskNumber}. {task.title}
                        </Button>
                      </div>
                    );
                  })
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardTitle>
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
            Fecha: {task.dueDate ? format(task.dueDate, "PPP", {locale: es}) : 'Sin fecha'}
          </span>
        )}


      </CardContent>
      <CardContent>
        <div className="flex justify-between mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {from !== 'Pendiente' && (
                  <IconButton
                    onClick={() => moveTask(task.id, from, 'Pendiente')}
                    icon={<Clock className="h-4 w-4"/>}
                    color="bg-blue-500"
                    tooltipText="Mover a Pendiente"
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>
                Mover a Pendiente
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                {from !== 'En Progreso' && (
                  <IconButton
                    onClick={() => moveTask(task.id, from, 'En Progreso')}
                    icon={<Settings className="h-4 w-4"/>}
                    color="bg-yellow-500"
                    tooltipText="Mover a En Progreso"
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>
                Mover a En Progreso
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                {from !== 'Completada' && (
                  <IconButton
                    onClick={() => moveTask(task.id, from, 'Completada')}
                    icon={<Check className="h-4 w-4"/>}
                    color="bg-green-500"
                    tooltipText="Mover a Completada"
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>
                Mover a Completada
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  onClick={() => confirmDeleteTask(task.id, from)}
                  icon={<Trash2 className="h-4 w-4"/>}
                  color="bg-red-500"
                  tooltipText="Eliminar Tarea"
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
  color: string;
  tooltipText: string;
}

function IconButton({onClick, icon, color, tooltipText}: IconButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" onClick={onClick} className={color}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
