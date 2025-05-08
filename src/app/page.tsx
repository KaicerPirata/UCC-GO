'use client';

import type { User } from 'firebase/auth'; // Keep User type for potential future use
import { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from '@/components/ui/card'; // Ensure CardTitle and CardDescription are imported
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleShadCN, // Rename import to avoid conflict
  DialogDescription as DialogDescriptionShadCN, // Rename import
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Settings, Trash2, Clock, Pencil, User as UserIcon, Plus, X } from 'lucide-react'; // Added Pencil, UserIcon, Plus, X icon
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
  getDoc, // Import getDoc
  setDoc, // Import setDoc
  query,
  Timestamp,
} from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


interface Task {
  id: string;
  title: string;
  description: string;
  dueDate?: Date;
  status: string;
  responsible?: string; // Add responsible field
  createdAt: Date; // Add createdAt field
}

// Removed App component, directly exporting MainContent as default
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

  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // State for responsible people
  const [responsiblePeople, setResponsiblePeople] = useState<string[]>([]); // Initial list empty, load from Firestore
  const [newResponsiblePerson, setNewResponsiblePerson] = useState<string | undefined>();
  const [newPersonName, setNewPersonName] = useState<string>('');
  const [loadingResponsible, setLoadingResponsible] = useState(true); // Loading state for responsible list
  const [isDeletePersonModalOpen, setIsDeletePersonModalOpen] = useState(false); // State for delete person modal


  const tasksCollection = collection(db, 'tasks');
  const configCollection = collection(db, 'appConfig'); // Collection for app config
  const responsiblePeopleDocRef = doc(configCollection, 'responsiblePeopleDoc'); // Document ref for responsible people

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

  // Effect to load data from Firestore on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoadingResponsible(true); // Start loading responsible people

      // Fetch Tasks
      try {
        const tasksQuery = query(tasksCollection);
        const snapshot = await getDocs(tasksQuery);

        const tasks: Task[] = snapshot.docs.map((doc) => {
          const data = doc.data();

          // Handle Due Date
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

          // Handle Created At Date
          let taskCreatedAt: Date;
          if (data.createdAt instanceof Timestamp) {
             taskCreatedAt = data.createdAt.toDate();
          } else if (typeof data.createdAt === 'string') {
            try {
                taskCreatedAt = new Date(data.createdAt);
                if (isNaN(taskCreatedAt.getTime())) {
                    console.warn(`Invalid createdAt date string for task ${doc.id}, using current time.`);
                    taskCreatedAt = new Date(); // Fallback to current date
                }
            } catch(e) {
                console.error(`Error parsing createdAt date string for task ${doc.id}, using current time.`, e);
                taskCreatedAt = new Date(); // Fallback to current date
            }
          } else {
            console.warn(`Missing or invalid createdAt field for task ${doc.id}, using current time.`);
            taskCreatedAt = new Date(); // Fallback if missing or invalid type
          }


          const status =
            typeof data.status === 'string' ? data.status : 'Pendiente';
          return {
            id: doc.id,
            title: data.title,
            description: data.description,
            status: status,
            dueDate: taskDueDate,
            responsible: data.responsible || undefined, // Fetch responsible person
            createdAt: taskCreatedAt, // Add createdAt
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

      // Fetch Responsible People
      try {
        const docSnap = await getDoc(responsiblePeopleDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (Array.isArray(data?.people)) {
            setResponsiblePeople(data.people);
          } else {
            // Document exists but 'people' field is missing or not an array
            console.warn("Document 'responsiblePeopleDoc' exists but 'people' field is invalid. Using default.");
            // Optionally set a default and create/update the document
            const defaultPeople = ['Juan Perez', 'Maria Garcia', 'Carlos Lopez'];
            setResponsiblePeople(defaultPeople);
            await setDoc(responsiblePeopleDocRef, { people: defaultPeople }, { merge: true }); // Create/update with default
          }
        } else {
          // Document doesn't exist, use default and create it
          console.log("Document 'responsiblePeopleDoc' not found. Creating with default.");
          const defaultPeople = ['Juan Perez', 'Maria Garcia', 'Carlos Lopez'];
          setResponsiblePeople(defaultPeople);
          await setDoc(responsiblePeopleDocRef, { people: defaultPeople }); // Create with default
        }
      } catch (error) {
        console.error('Error al cargar la lista de responsables:', error);
        toast({
          title: 'Error de conexión',
          description: 'No se pudo cargar la lista de responsables.',
          variant: 'destructive',
        });
        // Fallback to default if loading fails
        if (responsiblePeople.length === 0) {
            setResponsiblePeople(['Juan Perez', 'Maria Garcia', 'Carlos Lopez']);
        }
      } finally {
        setLoadingResponsible(false); // Finish loading responsible people
      }
    };

    fetchData();
  }, [toast]); // Removed collection refs as they are stable

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

  // Function to update responsible people in Firestore
  const updateResponsiblePeopleInFirestore = async (updatedList: string[]) => {
    try {
      await setDoc(responsiblePeopleDocRef, { people: updatedList }, { merge: true });
    } catch (error) {
      console.error('Error al actualizar la lista de responsables en Firestore:', error);
      toast({
        title: 'Error de sincronización',
        description: 'No se pudo guardar el cambio en la lista de responsables.',
        variant: 'destructive',
      });
      // Optionally revert local state or re-fetch
      // For simplicity, we'll just show the error for now
    }
  };

  const handleAddPerson = () => {
    const trimmedName = newPersonName.trim();
    if (trimmedName && !responsiblePeople.includes(trimmedName)) {
      const updatedList = [...responsiblePeople, trimmedName];
      setResponsiblePeople(updatedList);
      updateResponsiblePeopleInFirestore(updatedList); // Save to Firestore
      setNewPersonName(''); // Clear input after adding
      toast({
        title: '¡Persona añadida!',
        description: `${trimmedName} ha sido añadido a la lista de responsables.`,
      });
    } else if (!trimmedName) {
         toast({
            title: 'Nombre vacío',
            description: 'Por favor, ingresa un nombre.',
            variant: 'destructive',
        });
    } else {
         toast({
            title: 'Nombre duplicado',
            description: `${trimmedName} ya existe en la lista.`,
            variant: 'destructive',
        });
    }
  };

  const handleDeletePerson = (personToDelete: string) => {
      // Optional: Check if this person is assigned to any tasks before deleting
      const isAssigned = [...pendingTasks, ...inProgressTasks, ...completedTasks].some(
          task => task.responsible === personToDelete
      );

      if (isAssigned) {
          toast({
               title: 'Persona asignada',
               description: `${personToDelete} está asignado/a a una o más tareas. Eliminarlo/a de esta lista no lo/a desasignará de las tareas.`,
               variant: 'default',
               duration: 5000
          })
          // Decide whether to proceed with deletion from the list or block it
          // For now, we'll allow deletion from the list but warn the user.
      }

      const updatedList = responsiblePeople.filter(person => person !== personToDelete);
      setResponsiblePeople(updatedList);
      updateResponsiblePeopleInFirestore(updatedList); // Save to Firestore

      // If the currently selected responsible person for the new task is the one being deleted, reset it
      if (newResponsiblePerson === personToDelete) {
          setNewResponsiblePerson(undefined);
      }

      // If the person being edited in the task edit modal is the one being deleted, reset it in the modal
      if (taskToEdit?.responsible === personToDelete) {
         setTaskToEdit(prev => prev ? { ...prev, responsible: undefined } : null);
      }

      toast({
          title: '¡Persona eliminada!',
          description: `${personToDelete} ha sido eliminado/a de la lista de responsables.`,
      });
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

    const currentTimestamp = Timestamp.now(); // Get current timestamp for Firestore
    const currentDate = new Date(); // Get current date for local state

    const newTaskData = {
      title: newTaskTitle,
      description: newTaskDescription,
      dueDate: dueDate ? Timestamp.fromDate(dueDate) : null, // Save as Firestore Timestamp or null
      status: 'Pendiente',
      responsible: newResponsiblePerson || null, // Add responsible person
      createdAt: currentTimestamp, // Add createdAt timestamp for Firestore
    };

    try {
      // Add to Firestore first
      const docRef = await addDoc(tasksCollection, newTaskData);

      // Create the new task object for local state using the Firestore doc ID
      const newTask: Task = {
        ...newTaskData,
        id: docRef.id,
        dueDate: dueDate, // Use the Date object for local state consistency
        responsible: newResponsiblePerson, // Use state value
        createdAt: currentDate, // Use Date object for local state
      };

      // Use functional update for setPendingTasks
      setPendingTasks((prevPendingTasks) => [newTask, ...prevPendingTasks]);

      // Reset form fields
      setNewTaskTitle('');
      setNewTaskDescription('');
      setDueDate(undefined);
      setFormattedDate('Escoge una fecha');
      setNewResponsiblePerson(undefined); // Reset responsible person

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

  const openEditModal = (task: Task) => {
    setTaskToEdit(task);
    setIsEditModalOpen(true);
  };

  // Updated handleSaveChanges to exclude createdAt
  const handleSaveChanges = async (updatedTaskData: Omit<Task, 'id' | 'status' | 'responsible' | 'createdAt'>) => {
    if (!taskToEdit) return;

    const taskId = taskToEdit.id;
     // Keep the original responsible person and createdAt, don't update them
    const updatedTask: Task = { ...taskToEdit, ...updatedTaskData, responsible: taskToEdit.responsible, createdAt: taskToEdit.createdAt };


    // Prepare data for Firestore (convert Date to Timestamp or null)
    // Exclude 'responsible' and 'createdAt' from the data sent to Firestore for update
    const { responsible, createdAt, ...firestoreUpdateData } = updatedTaskData;
    const firestoreData = {
        ...firestoreUpdateData,
        dueDate: updatedTaskData.dueDate ? Timestamp.fromDate(updatedTaskData.dueDate) : null,
    };

    try {
      const taskDocRef = doc(db, 'tasks', taskId);
      await updateDoc(taskDocRef, firestoreData);

      // Update local state (keeping the original responsible person and createdAt)
      const updateStateTasks = (setter: React.Dispatch<React.SetStateAction<Task[]>>) => {
        setter((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? updatedTask : task
          )
        );
      };

      switch (taskToEdit.status) {
        case 'Pendiente':
          updateStateTasks(setPendingTasks);
          break;
        case 'En Progreso':
          updateStateTasks(setInProgressTasks);
          break;
        case 'Completada':
          updateStateTasks(setCompletedTasks);
          break;
      }

      // If the edited task was the selected one, update the selected task state as well
      if (selectedTask?.id === taskId) {
          setSelectedTask(updatedTask);
      }


      setIsEditModalOpen(false);
      setTaskToEdit(null);

      toast({
        title: '¡Tarea actualizada!',
        description: 'Los cambios se han guardado correctamente.',
      });
    } catch (error) {
      console.error('Error al actualizar la tarea:', error);
      toast({
        title: '¡Error!',
        description: 'No se pudieron guardar los cambios.',
        variant: 'destructive',
      });
    }
  };

  return (
    <TooltipProvider>
      <main className="flex min-h-screen flex-col p-4 md:p-24 gap-4 bg-background text-foreground">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-1 text-primary font-sans">
             CheckItOut
          </h1>
           <p className="text-lg text-muted-foreground font-sans">Tablero Kanban</p>
        </div>

        {/* Formulario para añadir tareas */}
        <Card className="mb-8 p-6 shadow-lg bg-card border border-border rounded-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-card-foreground">Añadir Nueva Tarea</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="mb-2">
              <Label
                htmlFor="newTaskTitle"
                className="block text-sm font-medium text-card-foreground mb-1">
                Título de la tarea:
              </Label>
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
              <Label
                htmlFor="newTaskDescription"
                className="block text-sm font-medium text-card-foreground mb-1">
                Descripción de la tarea:
              </Label>
              <Textarea
                id="newTaskDescription"
                placeholder="Ingresa la descripción de la tarea"
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                className="mt-1 shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-input rounded-md bg-background text-foreground"
              />
            </div>
             <div className="mb-2">
                 <Label htmlFor="responsiblePerson" className="block text-sm font-medium text-card-foreground mb-1">
                    Responsable:
                </Label>
                 <Select value={newResponsiblePerson} onValueChange={setNewResponsiblePerson} disabled={loadingResponsible}>
                    <SelectTrigger id="responsiblePerson" className="w-full mt-1 shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-input rounded-md bg-background text-foreground">
                        <SelectValue placeholder={loadingResponsible ? "Cargando..." : "Selecciona una persona"} />
                    </SelectTrigger>
                    <SelectContent>
                        {responsiblePeople.map((person) => (
                            <SelectItem key={person} value={person}>{person}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <div className="mt-4 space-y-2">
                     <div className="flex items-center gap-2">
                         <Input
                            type="text"
                            placeholder="Añadir nueva persona"
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                             className="flex-grow shadow-sm focus:ring-primary focus:border-primary sm:text-sm border-input rounded-md bg-background text-foreground"
                        />
                        <Button onClick={handleAddPerson} size="sm" variant="outline" aria-label="Añadir persona">
                           Añadir
                        </Button>
                         <Button onClick={() => setIsDeletePersonModalOpen(true)} size="sm" variant="destructive" aria-label="Eliminar persona" disabled={loadingResponsible || responsiblePeople.length === 0}>
                           Eliminar
                        </Button>
                     </div>
                    {/* Removed inline list display */}
                 </div>
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
            openEditModal={openEditModal} // Pass edit modal opener
            columnId="Pendiente"
            icon={<Clock className="h-8 w-8 text-yellow-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas Pendientes"
            tooltipText="Tareas por hacer"
            responsiblePeople={responsiblePeople} // Pass responsible people list
          />
          <KanbanColumn
            title="En Progreso"
            tasks={inProgressTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            openEditModal={openEditModal} // Pass edit modal opener
            columnId="En Progreso"
            icon={<Settings className="h-8 w-8 text-blue-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas En Progreso"
            tooltipText="Tareas en ejecución"
            responsiblePeople={responsiblePeople} // Pass responsible people list
          />
          <KanbanColumn
            title="Completada"
            tasks={completedTasks}
            moveTask={moveTask}
            confirmDeleteTask={confirmDeleteTask}
            openEditModal={openEditModal} // Pass edit modal opener
            columnId="Completada"
            icon={<Check className="h-8 w-8 text-green-500" />}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            selectedColumn={selectedColumn}
            setSelectedTask={setSelectedTask}
            setSelectedColumn={setSelectedColumn}
            dropdownTitle="Tareas Completadas"
            tooltipText="Tareas finalizadas"
            responsiblePeople={responsiblePeople} // Pass responsible people list
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

         {/* Edit Task Modal */}
        {taskToEdit && (
            <EditTaskModal
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setTaskToEdit(null);
                }}
                task={taskToEdit}
                onSave={handleSaveChanges}
                responsiblePeople={responsiblePeople} // Pass responsible people list
                // Removed props related to managing people list globally as it's disabled here
            />
        )}

         {/* Delete Person Modal */}
        <DeletePersonModal
            isOpen={isDeletePersonModalOpen}
            onClose={() => setIsDeletePersonModalOpen(false)}
            responsiblePeople={responsiblePeople}
            onDeletePerson={handleDeletePerson}
        />

      </main>
    </TooltipProvider>
  );
}
export default MainContent; // Export MainContent as default

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  moveTask: (taskId: string, from: string, to: string) => void;
  confirmDeleteTask: (taskId: string, from: string) => void;
  openEditModal: (task: Task) => void; // Added prop for opening edit modal
  columnId: string;
  icon: React.ReactNode;
  onTaskClick: (task: Task, columnId: string) => void;
  selectedTask: Task | null;
  selectedColumn: string | null;
  setSelectedTask: (task: Task | null) => void;
  setSelectedColumn: (columnId: string | null) => void; // Added this prop
  dropdownTitle: string;
  tooltipText: string;
  responsiblePeople: string[]; // Add responsible people list prop
}

function KanbanColumn({
  title,
  tasks,
  moveTask,
  confirmDeleteTask,
  openEditModal, // Receive edit modal opener
  columnId,
  icon,
  onTaskClick,
  selectedTask,
  selectedColumn,
  setSelectedTask,
  setSelectedColumn, // Receive the prop
  dropdownTitle,
  tooltipText,
  responsiblePeople, // Receive responsible people list
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
                                openEditModal={openEditModal} // Pass edit modal opener
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
  openEditModal: (task: Task) => void; // Added prop for opening edit modal
  from: string;
}

function TaskCard({ task, moveTask, confirmDeleteTask, openEditModal, from }: TaskCardProps) {
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
         <div className="text-sm">
             <strong className="text-foreground/80">Creada:</strong>{' '}
             <span className="text-muted-foreground">
               {task.createdAt instanceof Date
                 ? format(task.createdAt, 'PPP p', { locale: es }) // Format with time
                 : 'Fecha inválida'}
            </span>
         </div>
        {task.dueDate && (
          <div className="text-sm">
            <strong className="text-foreground/80">Vence:</strong>{' '}
            <span className={dueDateClassName}>
              {task.dueDate instanceof Date
                ? format(task.dueDate, 'PPP', { locale: es }) // Format date using Spanish locale
                : 'Fecha inválida'}
              {isOverdue && ' (Vencida)'}
              {isCloseToDueDate && ' (Próxima a vencer)'}
            </span>
          </div>
        )}
        {task.responsible && (
             <div className="text-sm">
                 <strong className="text-foreground/80">Responsable:</strong>{' '}
                 <span>{task.responsible}</span>
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
            {/* Edit Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEditModal(task)}
                  className="hover:bg-gray-500/20 text-gray-500 dark:text-gray-400 dark:hover:bg-gray-700/50"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar Tarea</TooltipContent>
            </Tooltip>
            {/* Delete Button */}
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

// Updated EditTaskModalProps interface
interface EditTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
    onSave: (updatedTaskData: Omit<Task, 'id' | 'status' | 'responsible' | 'createdAt'>) => void; // Exclude responsible & createdAt
    responsiblePeople: string[]; // Keep for display if needed, but disabled
}

function EditTaskModal({
    isOpen,
    onClose,
    task,
    onSave,
    responsiblePeople, // Keep for display if needed
}: EditTaskModalProps) {
    const [editedTitle, setEditedTitle] = useState(task.title);
    const [editedDescription, setEditedDescription] = useState(task.description);
    const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(task.dueDate);
    const [formattedModalDate, setFormattedModalDate] = useState<string>('Escoge una fecha');
    const { toast } = useToast(); // Get toast function


    // Update local state when the task prop changes (e.g., opening the modal for a different task)
    useEffect(() => {
        setEditedTitle(task.title);
        setEditedDescription(task.description);
        setEditedDueDate(task.dueDate);
        // No need to set editedResponsible or createdAt as they are not editable
    }, [task]);


    useEffect(() => {
        if (editedDueDate instanceof Date) {
            try {
                setFormattedModalDate(format(editedDueDate, 'PPP', { locale: es }));
            } catch (error) {
                console.error('Error formatting modal date:', error);
                setFormattedModalDate('Fecha inválida');
            }
        } else {
            setFormattedModalDate('Escoge una fecha');
        }
    }, [editedDueDate]);

    const handleModalDateChange = (date: Date | undefined) => {
        if (date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date >= today) {
                setEditedDueDate(date);
            } else {
                 toast({
                    title: 'Fecha inválida',
                    description: 'No puedes seleccionar una fecha pasada.',
                    variant: 'destructive',
                });
                // Optionally keep the old date or reset
                 setEditedDueDate(task.dueDate);
            }
        } else {
            setEditedDueDate(undefined);
        }
    };

    const handleSaveClick = () => {
        if (!editedTitle || !editedDescription) {
            toast({
                title: 'Faltan Datos',
                description: 'Por favor, completa el título y la descripción.',
                variant: 'destructive',
            });
            return;
        }
         if (!editedDueDate) {
            toast({
                title: 'Falta Fecha',
                description: 'Por favor, selecciona una fecha de vencimiento.',
                variant: 'destructive',
            });
            return;
        }
        // Pass only the editable fields to onSave
        onSave({
            title: editedTitle,
            description: editedDescription,
            dueDate: editedDueDate,
        });
        onClose(); // Close modal after saving
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
                <DialogHeader>
                    <DialogTitleShadCN>Editar Tarea</DialogTitleShadCN>
                    <DialogDescriptionShadCN>
                        Realiza los cambios necesarios en la tarea. Haz clic en guardar cuando termines.
                    </DialogDescriptionShadCN>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-title" className="text-right">
                            Título
                        </Label>
                        <Input
                            id="edit-title"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="col-span-3 bg-background text-foreground border-input"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="edit-description" className="text-right">
                            Descripción
                        </Label>
                        <Textarea
                            id="edit-description"
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            className="col-span-3 bg-background text-foreground border-input"
                        />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="edit-dueDate" className="text-right">
                            Fecha Venc.
                        </Label>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={'outline'}
                                className={cn(
                                'col-span-3 justify-start text-left font-normal',
                                !editedDueDate && 'text-muted-foreground',
                                'bg-card border-input hover:bg-accent hover:text-accent-foreground'
                                )}
                            >
                                {formattedModalDate}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-popover border-popover" align="start">
                            <Calendar
                                mode="single"
                                selected={editedDueDate}
                                onSelect={handleModalDateChange}
                                initialFocus
                                fromMonth={new Date()}
                                defaultMonth={editedDueDate || new Date()} // Start from selected or current
                                className="bg-popover text-popover-foreground"
                                locale={es}
                                classNames={{
                                day_selected:
                                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                                day_today: 'bg-accent text-accent-foreground',
                                }}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                     {/* Responsible Person Section - Disabled */}
                     <div className="grid grid-cols-4 items-start gap-4">
                         <Label className="text-right pt-2 text-muted-foreground">
                            Responsable
                        </Label>
                         <div className="col-span-3 space-y-2">
                            <Input
                                value={task.responsible || 'No asignado'}
                                disabled
                                className="w-full bg-muted/50 text-muted-foreground border-input"
                            />
                            <p className="text-xs text-muted-foreground italic">El responsable no se puede cambiar.</p>
                         </div>
                    </div>
                     {/* Created At Section - Display Only */}
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right text-muted-foreground">
                            Creada
                        </Label>
                        <div className="col-span-3 text-sm text-muted-foreground">
                           {task.createdAt instanceof Date
                                ? format(task.createdAt, 'PPP p', { locale: es })
                                : 'Fecha inválida'}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancelar
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSaveClick}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Delete Person Modal Component
interface DeletePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  responsiblePeople: string[];
  onDeletePerson: (personToDelete: string) => void;
}

function DeletePersonModal({
  isOpen,
  onClose,
  responsiblePeople,
  onDeletePerson,
}: DeletePersonModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitleShadCN>Eliminar Responsable</DialogTitleShadCN>
          <DialogDescriptionShadCN>
            Selecciona la persona que deseas eliminar de la lista de responsables.
            Esta acción no se puede deshacer y la eliminará permanentemente de la lista global.
          </DialogDescriptionShadCN>
        </DialogHeader>
        <div className="py-4 max-h-60 overflow-y-auto">
          {responsiblePeople.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">No hay responsables para eliminar.</p>
          ) : (
            <ul className="space-y-2">
              {responsiblePeople.map((person) => (
                <li key={person} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  <span className="text-sm">{person}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      onDeletePerson(person);
                      // Optionally close the modal after deletion or keep it open to delete more
                      // onClose(); // Uncomment to close after one deletion
                    }}
                    aria-label={`Eliminar ${person}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
