import numpy as np
import laspy
import json
import sys
from typing import Dict, List, Union, Optional
import random
from pathlib import Path
import time
import gc

class SimpleGroundClassifier:
    def __init__(self, laz_file_path: str):
        """Initialize with LAZ file path."""
        self.laz_file_path = laz_file_path
        self.las_data = None
        self.total_points = 0
        self.chunk_size = 10_000_000  # Process 10M points at a time
        
    def load_file(self) -> None:
        """Load the LAZ/LAS file with validation."""
        try:
            if not Path(self.laz_file_path).exists():
                raise FileNotFoundError(f"File not found: {self.laz_file_path}")
                
            self.las_data = laspy.read(self.laz_file_path)
            self.total_points = len(self.las_data.points)
            
            if self.total_points == 0:
                raise ValueError("Point cloud contains no points")
                
            print(f"Loaded point cloud with {self.total_points:,} points")
            
        except Exception as e:
            print(f"Error loading file: {str(e)}")
            raise
            
    def process_chunks(self) -> Dict[str, List[int]]:
        """Process points in chunks to manage memory."""
        ground_indices = []
        non_ground_indices = []
        
        for chunk_start in range(0, self.total_points, self.chunk_size):
            chunk_end = min(chunk_start + self.chunk_size, self.total_points)
            chunk_size = chunk_end - chunk_start
            
            # Generate random mask for this chunk
            chunk_mask = np.random.choice(
                [True, False],
                size=chunk_size,
                p=[0.5, 0.5]
            )
            
            # Get indices for this chunk
            chunk_ground = np.where(chunk_mask)[0] + chunk_start
            chunk_non_ground = np.where(~chunk_mask)[0] + chunk_start
            
            ground_indices.extend(chunk_ground.tolist())
            non_ground_indices.extend(chunk_non_ground.tolist())
            
            # Force garbage collection after each chunk
            gc.collect()
            
        return {
            "ground": sorted(ground_indices),
            "nonGround": sorted(non_ground_indices)
        }

    def classify_ground(self) -> Dict[str, Union[List[int], Dict[str, Union[int, str, float]]]]:
        """
        Randomly classify 50% of points as ground with enhanced metadata.
        """
        start_time = time.time()
        
        if not self.las_data:
            self.load_file()
        
        try:
            classification = self.process_chunks()
            
            processing_time = time.time() - start_time
            
            # Prepare output with detailed metadata
            result = {
                "metadata": {
                    "totalPoints": self.total_points,
                    "groundPoints": len(classification["ground"]),
                    "nonGroundPoints": len(classification["nonGround"]),
                    "fileProcessed": str(Path(self.laz_file_path).name),
                    "processingTimeSeconds": round(processing_time, 2),
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "chunkSize": self.chunk_size,
                    "success": True
                },
                "classification": classification
            }
            
            return result
            
        except Exception as e:
            return {
                "metadata": {
                    "success": False,
                    "error": str(e),
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                },
                "classification": {"ground": [], "nonGround": []}
            }

def main():
    """Main execution function with enhanced error handling."""
    if len(sys.argv) != 2:
        error = {
            "metadata": {
                "success": False,
                "error": "Invalid arguments. Usage: python ground_segmentation.py <laz_file_path>",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        print(json.dumps(error))
        sys.exit(1)
    
    try:
        laz_file_path = sys.argv[1]
        classifier = SimpleGroundClassifier(laz_file_path)
        result = classifier.classify_ground()
        print(json.dumps(result))
        sys.exit(0 if result["metadata"]["success"] else 1)
        
    except Exception as e:
        error = {
            "metadata": {
                "success": False,
                "error": str(e),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        print(json.dumps(error))
        sys.exit(1)

if __name__ == "__main__":
    main()