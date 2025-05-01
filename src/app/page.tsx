'use client';

import type {User} from 'firebase/auth';
import {useEffect, useState, useCallback} from 'react';
import {auth, db} from '@/lib/firebase'; // Import Firestore instance
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {Card, CardContent, CardHeader} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Calendar} from '@/components/ui/calendar';
import {cn} from '@/lib/utils';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {format, differenceInDays, isPast} from 'date-fns';
import {es} from 'date-fns/locale';
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
import {Check, Clock, Settings, Trash2} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {useToast} from '@/hooks/use-toast';
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
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: string;
  userId: string; // Añadir userId
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const {toast} = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({title: 'Éxito', description: 'Has iniciado sesión correctamente.'});
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      toast({
        title: 'Error',
        description: 'No se pudo iniciar sesión.',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({title: 'Éxito', description: 'Has cerrado sesión correctamente.'});
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cerrar sesión.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Cargando...
      </div>
    );
  }

  return (
    <>
      {user ? (
        <MainContent user={user} onSignOut={handleSignOut} />
      ) : (
        <SignIn onSignIn={handleSignIn} />
      )}
    </>
  );
}

function SignIn({onSignIn}: {onSignIn: () => void}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-2 font-sans">CheckItOut</h1>
      </div>
      <p className="mb-6 text-lg">Inicia sesión para continuar</p>
      <Button onClick={onSignIn} className="bg-blue-600 hover:bg-blue-700">
        Iniciar sesión con Google
      </Button>
    </div>
  );
}

interface MainContentProps {
  user: User;
  onSignOut: () => void;
}

function MainContent({user, onSignOut}: MainContentProps) {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskDescription, setNewTaskDescription] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [fromColumnToDelete, setFromColumnToDelete] = useState<string | null>(
    null
  );
  const [formattedDate, setFormattedDate] = useState('Escoge una fecha');
  const {toast} = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showDateAlert, setShowDateAlert] = useState(false);
  const [showDuplicateTaskAlert, setShowDuplicateTaskAlert] = useState(false);

  const tasksCollection = collection(db, 'tasks');

  useEffect(() => {
    if (dueDate instanceof Date) {
      setFormattedDate(format(dueDate, 'PPP', {locale: es}));
    } else {
      setFormattedDate('Escoge una fecha');
    }
  }, [dueDate]);

  // Effect para escuchar cambios en Firestore
  useEffect(() => {
    if (!user) return; // No hacer nada si el usuario no está autenticado

    // Crear consulta para obtener solo las tareas del usuario actual
    const userTasksQuery = query(tasksCollection, where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(
      userTasksQuery,
      (snapshot) => {
        const tasks: Task[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Convertir Timestamp de Firestore a Date de JavaScript
          const dueDate = data.dueDate instanceof Timestamp
            ? data.dueDate.toDate()
            : data.dueDate ? new Date(data.dueDate) : undefined; // Fallback por si acaso
          const status = typeof data.status === 'string' ? data.status : 'Pendiente';
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            status: status,
            userId: data.userId,
            dueDate: dueDate,
          } as Task; // Asegurar que los campos requeridos están
        });


        // Separar las tareas en las diferentes listas
        const pending = tasks.filter((task) => task.status === 'Pendiente');
        const inProgress = tasks.filter((task) => task.status === 'En Progreso');
        const completed = tasks.filter((task) => task.status === 'Completada');

        setPendingTasks(pending);
        setInProgressTasks(inProgress);
        setCompletedTasks(completed);
      },
      (error) => {
        // Manejar errores al escuchar
        console.error('Error al escuchar tareas:', error);
        toast({
          title: 'Error de conexión',
          description: 'No se pudieron cargar las tareas.',
          variant: 'destructive',
        });
      }
    );

    return () => unsubscribe(); // Cleanup function al desmontar
  }, [user, tasksCollection, toast]); // Dependencias: user, tasksCollection, toast


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

    if (!user) {
       toast({title: "Error", description: "Debes estar autenticado para añadir tareas.", variant: "destructive"});
       return;
    }

    // Verificar si ya existe una tarea con el mismo título
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
        userId: user.uid, // Guardar el ID del usuario
      });

      // Limpiar los campos después de añadir
      setNewTaskTitle('');
      setNewTaskDescription('');
      setDueDate(undefined);
      setFormattedDate('Escoge una fecha');
      toast({
        title: 'Tarea agregada!',
        description: 'Tarea agregada a Pendiente.',
      });
    } catch (error) {
      console.error('Error al agregar la tarea:', error);
      toast({
        title: 'Error!',
        description: 'Error al agregar la tarea.',
        variant: 'destructive', // Marcar como error
      });
    }
  };

  const moveTask = async (taskId: string, from: string, to: string) => {
    let taskToMove: Task | undefined;
    let updatedPendingTasks = [...pendingTasks];
    let updatedInProgressTasks = [...inProgressTasks];
    let updatedCompletedTasks = [...completedTasks];

    const removeTask = (
      tasks: Task[],
      setTasks: React.Dispatch<React.SetStateAction<Task[]>>
    ) => {
      const taskIndex = tasks.findIndex((task) => task.id === taskId);
      if (taskIndex > -1) {
        taskToMove = tasks[taskIndex];
        const newTasks = [...tasks];
        newTasks.splice(taskIndex, 1);
        setTasks(newTasks); // Actualiza el estado local inmediatamente
        return newTasks; // Devuelve las tareas actualizadas
      }
      return tasks; // Devuelve las tareas originales si no se encuentra
    };

    // Remover la tarea de la lista 'from' y actualizar el estado local
    if (from === 'Pendiente') {
      updatedPendingTasks = removeTask(pendingTasks, setPendingTasks);
    } else if (from === 'En Progreso') {
      updatedInProgressTasks = removeTask(inProgressTasks, setInProgressTasks);
    } else if (from === 'Completada') {
      updatedCompletedTasks = removeTask(completedTasks, setCompletedTasks);
    }

    if (!taskToMove) {
       console.error("No se encontró la tarea a mover.");
       return;
    }

    // Añadir la tarea a la nueva lista 'to' en el estado local
    taskToMove.status = to;
    if (to === 'Pendiente') {
      setPendingTasks([taskToMove, ...updatedPendingTasks]);
    } else if (to === 'En Progreso') {
      setInProgressTasks([taskToMove, ...updatedInProgressTasks]);
    } else if (to === 'Completada') {
      setCompletedTasks([taskToMove, ...updatedCompletedTasks]);
    }

    setSelectedTask(null); // Deseleccionar la tarea después de moverla

    try {
      // Actualiza el estado de la tarea en Firestore
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, {
        status: to,
      });

      toast({
        title: 'Tarea movida!',
        description: `Tarea movida de ${from} a ${to}.`,
      });
    } catch (error) {
      console.error('Error al mover la tarea:', error);
      toast({
        title: 'Error!',
        description: 'Error al mover la tarea.',
        variant: 'destructive',
      });

      // Revertir el cambio en el estado local si Firestore falla
      // Volver a añadir la tarea a la columna original y quitarla de la nueva
      taskToMove.status = from; // Restaurar estado original
       if (to === 'Pendiente') {
         setPendingTasks(pendingTasks.filter(t => t.id !== taskId));
       } else if (to === 'En Progreso') {
         setInProgressTasks(inProgressTasks.filter(t => t.id !== taskId));
       } else if (to === 'Completada') {
         setCompletedTasks(completedTasks.filter(t => t.id !== taskId));
       }

      if (from === 'Pendiente') {
        setPendingTasks([taskToMove, ...pendingTasks.filter(t => t.id !== taskId)]);
      } else if (from === 'En Progreso') {
        setInProgressTasks([taskToMove, ...inProgressTasks.filter(t => t.id !== taskId)]);
      } else if (from === 'Completada') {
        setCompletedTasks([taskToMove, ...completedTasks.filter(t => t.id !== taskId)]);
      }
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

    switch (fromColumn) {
      case 'Pendiente':
        updatedTasks = pendingTasks.filter((task) => task.id !== taskId);
        taskToRemove = pendingTasks.find((task) => task.id === taskId);
        setPendingTasks(updatedTasks);
        break;
      case 'En Progreso':
        updatedTasks = inProgressTasks.filter((task) => task.id !== taskId);
        taskToRemove = inProgressTasks.find((task) => task.id === taskId);
        setInProgressTasks(updatedTasks);
        break;
      case 'Completada':
        updatedTasks = completedTasks.filter((task) => task.id !== taskId);
        taskToRemove = completedTasks.find((task) => task.id === taskId);
        setCompletedTasks(updatedTasks);
        break;
      default:
        console.error('Columna inválida:', fromColumn);
        setOpen(false); // Asegúrate de cerrar el diálogo
        setTaskToDelete(null);
        setFromColumnToDelete(null);
        return;
    }

    setOpen(false);
    setTaskToDelete(null);
    setFromColumnToDelete(null);
    setSelectedTask(null); // Deseleccionar si la tarea eliminada estaba seleccionada

    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      await deleteDoc(taskDocRef);

      toast({
        title: 'Tarea eliminada!',
        description: 'Tarea eliminada permanentemente.',
      });
    } catch (error) {
      console.error('Error al eliminar la tarea:', error);
      toast({
        title: 'Error!',
        description: 'Error al eliminar la tarea.',
        variant: 'destructive',
      });
      // Revert the UI update if deletion fails
      if (taskToRemove) {
        switch (fromColumn) {
          case 'Pendiente':
            setPendingTasks([taskToRemove, ...updatedTasks]);
            break;
          case 'En Progreso':
            setInProgressTasks([taskToRemove, ...updatedTasks]);
            break;
          case 'Completada':
            setCompletedTasks([taskToRemove, ...updatedTasks]);
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
        <div className="flex justify-between items-center mb-8">
          <div className="text-center flex-grow">
             <h1 className="text-5xl font-bold mb-2 font-sans text-white">CheckItOut</h1>
          </div>
          <Button onClick={onSignOut} variant="destructive">
            Cerrar Sesión
          </Button>
        </div>


        <div className="flex flex-col gap-4 bg-card p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-card-foreground">
            Añadir Nueva Tarea
          </h2>
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
              className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md bg-input text-foreground"
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
              className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md bg-input text-foreground"
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
                    'bg-input border-input hover:bg-accent hover:text-accent-foreground'
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
                  classNames={{
                     day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                     day_today: "bg-accent text-accent-foreground",
                  }}
                />
              </PopoverContent>
            </Popover>

            <Button
              onClick={handleAddTask}
              className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700">
              Añadir Tarea
            </Button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <KanbanColumn
            title="Pendiente"
            tasks={pendingTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            columnId="Pendiente"
            icon={<Clock className="h-4 w-4" />}
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
            icon={<Settings className="h-4 w-4" />}
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
            icon={<Check className="h-4 w-4" />}
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
  tooltipText,
}: KanbanColumnProps) {
  const getColumnBackgroundColor = () => {
    // Usa colores más oscuros o temáticos para el modo oscuro
    switch (title) {
      case 'Pendiente':
        return 'bg-gray-800 border border-gray-700'; // Gris oscuro
      case 'En Progreso':
        return 'bg-blue-900 border border-blue-800'; // Azul oscuro
      case 'Completada':
        return 'bg-green-900 border border-green-800'; // Verde oscuro
      default:
        return 'bg-gray-900 border border-gray-700'; // Negro/gris muy oscuro por defecto
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
    <Card
      className={`w-full md:w-80 rounded-md shadow-lg ${getColumnBackgroundColor()} hover:shadow-xl transition-shadow duration-300 text-white`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
        <Accordion
          type="single"
          collapsible
          className="w-full"
          onValueChange={handleAccordionClick}>
          <AccordionItem value={columnId} className="border-b-0">
            <AccordionTrigger className="text-lg font-semibold flex items-center justify-between w-full hover:no-underline py-2 px-2 rounded hover:bg-gray-700 transition-colors">
               <div className="flex items-center gap-2">
                 {icon}
                 <span>{tasks.length} {displayTitle}</span>
               </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 px-2">
              {tasks.length === 0 ? (
                <div className="text-sm text-gray-400 italic py-4 text-center">
                  No hay tareas en esta sección.
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {tasks.map((task, index) => (
                    <Button
                      key={task.id}
                      variant="ghost"
                      className="w-full justify-start hover:bg-gray-700 text-left py-2 px-3 rounded transition-colors text-sm"
                      onClick={() => onTaskClick(task, columnId)}>
                      {index + 1}. {task.title}
                    </Button>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardHeader>
      <CardContent className="p-4 pt-0">
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
  const isCloseToDueDate = task.dueDate
    ? differenceInDays(task.dueDate, new Date()) <= 3 && !isPast(task.dueDate) // Cerca si faltan 3 días o menos y no está pasada
    : false;
  const isOverdue = task.dueDate ? isPast(task.dueDate) : false;

  let dueDateClassName = 'text-gray-400'; // Default color
  if (isOverdue) {
    dueDateClassName = 'text-red-500 font-semibold'; // Overdue tasks in bold red
  } else if (isCloseToDueDate) {
    dueDateClassName = 'text-yellow-500'; // Tasks close to due date in yellow
  }

  return (
    <Card className="bg-gray-800 rounded-lg shadow-md border border-gray-700 p-4 mt-4 text-white">
      <CardContent className="flex flex-col gap-2 pb-0">
        <div className="text-sm">
          <strong className="text-gray-300">Título:</strong> {task.title}
        </div>
        <div className="text-sm">
          <strong className="text-gray-300">Descripción:</strong>{' '}
          {task.description}
        </div>
        {task.dueDate && (
          <div className="text-sm">
            <strong className="text-gray-300">Fecha:</strong>{' '}
            <span className={dueDateClassName}>
              {format(task.dueDate, 'PPP', {locale: es})}
              {isOverdue && ' (Vencida)'}
              {isCloseToDueDate && ' (Próxima a vencer)'}
            </span>
          </div>
        )}
      </CardContent>
      <CardContent className="pt-4">
        <div className="flex justify-around mt-2 border-t border-gray-700 pt-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'Pendiente')}
                  className={cn(
                    'hover:bg-blue-800 text-blue-400',
                    from === 'Pendiente' && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={from === 'Pendiente'}>
                  <Clock className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mover a Pendiente</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'En Progreso')}
                  className={cn(
                    'hover:bg-yellow-800 text-yellow-400',
                    from === 'En Progreso' && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={from === 'En Progreso'}>
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mover a En Progreso</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => moveTask(task.id, from, 'Completada')}
                  className={cn(
                    'hover:bg-green-800 text-green-400',
                    from === 'Completada' && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={from === 'Completada'}>
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mover a Completada</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => confirmDeleteTask(task.id, from)}
                  className="hover:bg-red-800 text-red-400">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar Tarea</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}


