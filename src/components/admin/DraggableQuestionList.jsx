import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Edit2, Star, MessageSquare, ThumbsUp, Smile, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';

const questionTypeIcons = {
  stars: Star,
  text: MessageSquare,
  boolean: ThumbsUp,
  faces: Smile,
  rating: Star,
};

const questionTypeLabels = {
  stars: 'Estrelas',
  text: 'Texto',
  boolean: 'Sim/Não',
  faces: 'Carinhas',
  rating: 'Nota 1-10',
};

export default function DraggableQuestionList({ questions, onReorder, onEdit, onDelete }) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(questions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorder(items);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="questions">
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`space-y-3 p-4 rounded-xl transition-colors ${
              snapshot.isDraggingOver ? 'bg-indigo-50 border-2 border-dashed border-indigo-300' : 'bg-gray-50'
            }`}
          >
            {questions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">Nenhuma pergunta adicionada</p>
                <p className="text-xs mt-1">Clique em "Adicionar Pergunta" para começar</p>
              </div>
            ) : (
              questions.map((question, index) => {
                const Icon = questionTypeIcons[question.type] || MessageSquare;
                return (
                  <Draggable key={question.id} draggableId={question.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white rounded-lg border-2 p-4 transition-all ${
                          snapshot.isDragging
                            ? 'border-indigo-500 shadow-2xl rotate-2 scale-105'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
                          >
                            <GripVertical className="w-5 h-5" />
                          </div>

                          {/* Question Number */}
                          <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600">
                            {index + 1}
                          </div>

                          {/* Question Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-xs font-medium text-gray-500">
                                {questionTypeLabels[question.type]}
                              </span>
                              {question.required && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  Obrigatória
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 break-words">
                              {question.question}
                            </p>
                            
                            {/* Skip Logic Badge */}
                            {question.skip_logic?.enabled && question.skip_logic?.conditions?.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                  🔀 Lógica de Pulo
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(question)}
                              className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600"
                              title="Configurar Lógica de Pulo"
                            >
                              <GitBranch className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(question)}
                              className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(question.id)}
                              className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}