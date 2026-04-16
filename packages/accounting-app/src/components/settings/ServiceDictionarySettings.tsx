import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, BookOpen, CheckCircle } from 'lucide-react';
import { serviceDictionary, ServiceDictionaryEntry } from '../../lib/service-dictionary';

const ServiceDictionarySettings: React.FC = () => {
  const [services, setServices] = useState<ServiceDictionaryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newService, setNewService] = useState({
    title: '',
    unit: '',
    price: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load real services from serviceDictionary
    setServices(serviceDictionary.getAll());

    // Subscribe to changes from other tabs/windows
    const unsubscribe = serviceDictionary.onChange(() => {
      setServices(serviceDictionary.getAll());
    });

    return unsubscribe;
  }, []);

  const handleAddService = () => {
    if (!newService.title.trim() || !newService.unit.trim() || !newService.price) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    serviceDictionary.add({
      title: newService.title,
      unit: newService.unit,
      price: parseFloat(newService.price),
    });

    setServices(serviceDictionary.getAll());
    setNewService({ title: '', unit: '', price: '' });
    setIsAdding(false);
    setMessage({ type: 'success', text: 'Service added successfully' });
    setTimeout(() => setMessage(null), 2000);
  };

  const handleEditService = (id: string, field: string, value: string) => {
    serviceDictionary.update(id, {
      [field]: field === 'price' ? parseFloat(value) || 0 : value,
    });
    setServices(serviceDictionary.getAll());
  };

  const handleDeleteService = (id: string) => {
    if (!confirm('Delete this service?')) return;
    serviceDictionary.delete(id);
    setServices(serviceDictionary.getAll());
    setMessage({ type: 'success', text: 'Service deleted' });
    setTimeout(() => setMessage(null), 2000);
  };

  const filteredServices = services.filter(
    s =>
      s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.unit?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 border rounded-xl ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          }`}
        >
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Add Service Card */}
      <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        )}

        {isAdding && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">New Service</h3>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Service name"
                value={newService.title}
                onChange={e => setNewService({ ...newService, title: e.target.value })}
                className="px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors text-sm"
              />
              <input
                type="text"
                placeholder="Unit (e.g., hour)"
                value={newService.unit}
                onChange={e => setNewService({ ...newService, unit: e.target.value })}
                className="px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors text-sm"
              />
              <input
                type="number"
                placeholder="Price"
                value={newService.price}
                onChange={e => setNewService({ ...newService, price: e.target.value })}
                className="px-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAddService}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewService({ title: '', unit: '', price: '' });
                }}
                className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg font-medium text-sm hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search services..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-2.5 bg-muted/30 border border-transparent rounded-xl focus:outline-none focus:bg-card focus:border-primary/30 transition-colors"
        />
      </div>

      {/* Services List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Services ({filteredServices.length})
        </h3>

        {filteredServices.length === 0 ? (
          <div className="p-6 text-center bg-muted/30 rounded-xl border border-border">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {services.length === 0 ? 'No services yet' : 'No results found'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredServices.map(service => (
              <div
                key={service.id}
                className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors group"
              >
                <div className="flex-1 grid grid-cols-3 gap-3 text-sm">
                  <input
                    type="text"
                    value={service.title}
                    onChange={e => handleEditService(service.id, 'title', e.target.value)}
                    className="px-3 py-1.5 bg-muted/30 border border-transparent rounded-lg focus:outline-none focus:bg-card focus:border-primary/30 transition-colors font-medium text-foreground"
                  />
                  <input
                    type="text"
                    value={service.unit}
                    onChange={e => handleEditService(service.id, 'unit', e.target.value)}
                    className="px-3 py-1.5 bg-muted/30 border border-transparent rounded-lg focus:outline-none focus:bg-card focus:border-primary/30 transition-colors text-muted-foreground"
                  />
                  <input
                    type="number"
                    value={service.price}
                    onChange={e => handleEditService(service.id, 'price', e.target.value)}
                    className="px-3 py-1.5 bg-muted/30 border border-transparent rounded-lg focus:outline-none focus:bg-card focus:border-primary/30 transition-colors text-right"
                  />
                </div>

                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="p-2 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceDictionarySettings;
